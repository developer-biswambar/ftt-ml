import io
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.recon_models import ReconciliationResponse, ReconciliationSummary, OptimizedRulesConfig
from app.services.reconciliation_service import OptimizedFileProcessor, optimized_reconciliation_storage

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


class ReconciliationRequest(BaseModel):
    """Enhanced reconciliation request with column selection"""
    selected_columns_file_a: Optional[List[str]] = None
    selected_columns_file_b: Optional[List[str]] = None
    output_format: Optional[str] = "standard"  # standard, summary, detailed


class FileReference(BaseModel):
    """File reference for JSON-based reconciliation"""
    file_id: str
    role: str  # file_0, file_1
    label: str


class ReconciliationConfig(BaseModel):
    """Reconciliation configuration from JSON input"""
    Files: List[Dict[str, Any]]
    ReconciliationRules: List[Dict[str, Any]]
    selected_columns_file_a: Optional[List[str]] = None
    selected_columns_file_b: Optional[List[str]] = None
    user_requirements: Optional[str] = None
    files: Optional[List[FileReference]] = None


class JSONReconciliationRequest(BaseModel):
    """JSON-based reconciliation request"""
    process_type: str
    process_name: str
    user_requirements: str
    files: List[FileReference]
    reconciliation_config: ReconciliationConfig


async def get_file_by_id(file_id: str) -> UploadFile:
    """
    Retrieve file by ID from your file storage service
    Uses the existing uploaded_files storage from storage_service
    """
    # Import here to avoid circular imports
    from app.services.storage_service import uploaded_files

    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")

    try:
        file_data = uploaded_files[file_id]
        file_info = file_data["info"]
        df = file_data["data"]

        # Convert DataFrame back to file-like object
        filename = file_info["filename"]

        if filename.lower().endswith('.csv'):
            # Convert DataFrame to CSV bytes
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            csv_content = csv_buffer.getvalue().encode('utf-8')
            file_content = io.BytesIO(csv_content)
        elif filename.lower().endswith(('.xlsx', '.xls')):
            # Convert DataFrame to Excel bytes
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name='Sheet1')
            excel_buffer.seek(0)
            file_content = excel_buffer
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {filename}")

        # Create UploadFile-like object
        class FileFromStorage:
            def __init__(self, content: io.BytesIO, filename: str):
                self.file = content
                self.filename = filename
                self.content_type = self._get_content_type(filename)

            def _get_content_type(self, filename: str) -> str:
                if filename.lower().endswith('.csv'):
                    return 'text/csv'
                elif filename.lower().endswith('.xlsx'):
                    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                elif filename.lower().endswith('.xls'):
                    return 'application/vnd.ms-excel'
                return 'application/octet-stream'

            async def read(self):
                return self.file.read()

            def seek(self, position: int):
                return self.file.seek(position)

        return FileFromStorage(file_content, filename)

    except Exception as e:
        logger.error(f"Error retrieving file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")


@router.post("/process/postman", response_model=ReconciliationResponse)
async def process_reconciliation_optimized(
        fileA: UploadFile = File(...),
        fileB: UploadFile = File(...),
        rules: str = Form(...),
        selected_columns_file_a: Optional[str] = Form(None),
        selected_columns_file_b: Optional[str] = Form(None),
        output_format: Optional[str] = Form("standard")
):
    """Process file reconciliation with optimized performance and column selection - File Upload Version"""
    start_time = datetime.now()
    processor = OptimizedFileProcessor()

    try:
        # Parse rules
        rules_config = OptimizedRulesConfig.parse_raw(rules)

        # Parse column selections
        columns_a = None
        columns_b = None

        if selected_columns_file_a:
            try:
                columns_a = json.loads(selected_columns_file_a) if selected_columns_file_a.startswith(
                    '[') else selected_columns_file_a.split(',')
                columns_a = [col.strip() for col in columns_a]
            except json.JSONDecodeError:
                columns_a = [col.strip() for col in selected_columns_file_a.split(',')]

        if selected_columns_file_b:
            try:
                columns_b = json.loads(selected_columns_file_b) if selected_columns_file_b.startswith(
                    '[') else selected_columns_file_b.split(',')
                columns_b = [col.strip() for col in columns_b]
            except json.JSONDecodeError:
                columns_b = [col.strip() for col in selected_columns_file_b.split(',')]

        return await _process_reconciliation_core(
            processor, rules_config, fileA, fileB, columns_a, columns_b, output_format, start_time
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Reconciliation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.post("/process/", response_model=ReconciliationResponse)
async def process_reconciliation_json(
        request: JSONReconciliationRequest
):
    """Process file reconciliation with JSON input - File ID Version"""
    start_time = datetime.now()
    processor = OptimizedFileProcessor()

    try:
        # Validate request
        if request.process_type != "reconciliation":
            raise HTTPException(status_code=400, detail="Invalid process_type. Expected 'reconciliation'")

        if len(request.files) != 2:
            raise HTTPException(status_code=400, detail="Exactly 2 files are required for reconciliation")

        # Sort files by role to ensure consistent mapping
        files_sorted = sorted(request.files, key=lambda x: x.role)
        file_0 = next((f for f in files_sorted if f.role == "file_0"), None)
        file_1 = next((f for f in files_sorted if f.role == "file_1"), None)

        if not file_0 or not file_1:
            raise HTTPException(status_code=400, detail="Files must have roles 'file_0' and 'file_1'")

        # Retrieve files by ID
        try:
            fileA = await get_file_by_id(file_0.file_id)
            fileB = await get_file_by_id(file_1.file_id)
        except NotImplementedError:
            raise HTTPException(status_code=501,
                                detail="File retrieval service not implemented. Please implement get_file_by_id function.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Failed to retrieve files: {str(e)}")

        # Convert reconciliation config to OptimizedRulesConfig
        rules_dict = {
            "Files": request.reconciliation_config.Files,
            "ReconciliationRules": request.reconciliation_config.ReconciliationRules
        }
        rules_config = OptimizedRulesConfig.parse_obj(rules_dict)

        # Extract column selections
        columns_a = request.reconciliation_config.selected_columns_file_a
        columns_b = request.reconciliation_config.selected_columns_file_b

        return await _process_reconciliation_core(
            processor, rules_config, fileA, fileB, columns_a, columns_b, "standard", start_time
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"JSON Reconciliation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


async def _process_reconciliation_core(
        processor: OptimizedFileProcessor,
        rules_config: OptimizedRulesConfig,
        fileA: UploadFile,
        fileB: UploadFile,
        columns_a: Optional[List[str]],
        columns_b: Optional[List[str]],
        output_format: str,
        start_time: datetime
) -> ReconciliationResponse:
    """Core reconciliation processing logic shared between endpoints"""

    # Validate we have rules for both files
    if len(rules_config.Files) != 2:
        raise HTTPException(status_code=400, detail="Rules must contain exactly 2 file configurations")

    # Read files with optimized settings
    file_rule_a = next((f for f in rules_config.Files if f.Name == "FileA"), None)
    file_rule_b = next((f for f in rules_config.Files if f.Name == "FileB"), None)

    if not file_rule_a or not file_rule_b:
        raise HTTPException(status_code=400, detail="Rules must contain configurations for 'FileA' and 'FileB'")

    # Read files
    df_a = processor.read_file(fileA, getattr(file_rule_a, 'SheetName', None))
    df_b = processor.read_file(fileB, getattr(file_rule_b, 'SheetName', None))

    print(f"Read files: FileA {len(df_a)} rows, FileB {len(df_b)} rows")

    # Validate rules against columns
    errors_a = processor.validate_rules_against_columns(df_a, file_rule_a)
    errors_b = processor.validate_rules_against_columns(df_b, file_rule_b)

    if errors_a or errors_b:
        processor.errors.extend(errors_a + errors_b)
        raise HTTPException(status_code=400, detail={"errors": processor.errors})

    # Process FileA with optimized extraction - Handle optional Extract
    if hasattr(file_rule_a, 'Extract') and file_rule_a.Extract:
        print("Processing FileA extractions...")
        for extract_rule in file_rule_a.Extract:
            df_a[extract_rule.ResultColumnName] = processor.extract_patterns_vectorized(df_a, extract_rule)

    # Apply FileA filters - Handle optional Filter
    if hasattr(file_rule_a, 'Filter') and file_rule_a.Filter:
        print("Applying FileA filters...")
        df_a = processor.apply_filters_optimized(df_a, file_rule_a.Filter)

    # Process FileB with optimized extraction - Handle optional Extract
    if hasattr(file_rule_b, 'Extract') and file_rule_b.Extract:
        print("Processing FileB extractions...")
        for extract_rule in file_rule_b.Extract:
            df_b[extract_rule.ResultColumnName] = processor.extract_patterns_vectorized(df_b, extract_rule)

    # Apply FileB filters - Handle optional Filter
    if hasattr(file_rule_b, 'Filter') and file_rule_b.Filter:
        print("Applying FileB filters...")
        df_b = processor.apply_filters_optimized(df_b, file_rule_b.Filter)

    print(f"After processing: FileA {len(df_a)} rows, FileB {len(df_b)} rows")

    # Validate reconciliation columns exist
    recon_errors = []
    for rule in rules_config.ReconciliationRules:
        if rule.LeftFileColumn not in df_a.columns:
            recon_errors.append(
                f"Reconciliation column '{rule.LeftFileColumn}' not found in FileA after extraction")
        if rule.RightFileColumn not in df_b.columns:
            recon_errors.append(
                f"Reconciliation column '{rule.RightFileColumn}' not found in FileB after extraction")

    if recon_errors:
        processor.errors.extend(recon_errors)
        raise HTTPException(status_code=400, detail={"errors": processor.errors})

    # Perform optimized reconciliation
    print("Starting optimized reconciliation...")
    reconciliation_results = processor.reconcile_files_optimized(
        df_a, df_b, rules_config.ReconciliationRules,
        columns_a, columns_b
    )

    # Generate reconciliation ID
    recon_id = str(uuid.uuid4())

    # Store results with optimized storage
    storage_success = optimized_reconciliation_storage.store_results(recon_id, reconciliation_results)
    if not storage_success:
        processor.warnings.append("Failed to store results in optimized storage, using fallback")

    # Calculate summary
    processing_time = (datetime.now() - start_time).total_seconds()
    total_a = len(df_a)
    total_b = len(df_b)
    matched = len(reconciliation_results['matched'])

    # Handle division by zero for match percentage
    if max(total_a, total_b) > 0:
        match_percentage = round((matched / max(total_a, total_b)) * 100, 2)
    else:
        match_percentage = 0.0

    summary = ReconciliationSummary(
        total_records_file_a=total_a,
        total_records_file_b=total_b,
        matched_records=matched,
        unmatched_file_a=len(reconciliation_results['unmatched_file_a']),
        unmatched_file_b=len(reconciliation_results['unmatched_file_b']),
        match_percentage=match_percentage,
        processing_time_seconds=round(processing_time, 3)
    )

    print(f"Reconciliation completed in {processing_time:.2f}s - {matched} matches found")

    return ReconciliationResponse(
        success=True,
        summary=summary,
        reconciliation_id=recon_id,
        errors=processor.errors,
        warnings=processor.warnings
    )


@router.get("/results/{reconciliation_id}")
async def get_reconciliation_results_optimized(
        reconciliation_id: str,
        result_type: Optional[str] = "all",  # all, matched, unmatched_a, unmatched_b
        page: Optional[int] = 1,
        page_size: Optional[int] = 1000
):
    """Get reconciliation results with pagination for large datasets"""

    # Try optimized storage first
    results = optimized_reconciliation_storage.get_results(reconciliation_id)

    if not results:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    # Calculate pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    def paginate_results(data_list):
        return data_list[start_idx:end_idx]

    response_data = {
        'reconciliation_id': reconciliation_id,
        'timestamp': results['timestamp'].isoformat(),
        'row_counts': results['row_counts'],
        'pagination': {
            'page': page,
            'page_size': page_size,
            'start_index': start_idx
        }
    }

    if result_type == "all":
        response_data.update({
            'matched': paginate_results(results['matched']),
            'unmatched_file_a': paginate_results(results['unmatched_file_a']),
            'unmatched_file_b': paginate_results(results['unmatched_file_b'])
        })
    elif result_type == "matched":
        response_data['matched'] = paginate_results(results['matched'])
    elif result_type == "unmatched_a":
        response_data['unmatched_file_a'] = paginate_results(results['unmatched_file_a'])
    elif result_type == "unmatched_b":
        response_data['unmatched_file_b'] = paginate_results(results['unmatched_file_b'])
    else:
        raise HTTPException(status_code=400, detail="Invalid result_type. Use: all, matched, unmatched_a, unmatched_b")

    return response_data


@router.get("/download/{reconciliation_id}")
async def download_reconciliation_results_optimized(
        reconciliation_id: str,
        format: str = "excel",
        result_type: str = "all",  # all, matched, unmatched_a, unmatched_b
        compress: bool = True
):
    """Download reconciliation results with optimized streaming for large files"""

    results = optimized_reconciliation_storage.get_results(reconciliation_id)
    if not results:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    try:
        # Convert back to DataFrames for download
        matched_df = pd.DataFrame(results['matched'])
        unmatched_a_df = pd.DataFrame(results['unmatched_file_a'])
        unmatched_b_df = pd.DataFrame(results['unmatched_file_b'])

        if format.lower() == "excel":
            # Create Excel file with streaming for large datasets
            output = io.BytesIO()

            with pd.ExcelWriter(output, engine='xlsxwriter', options={'strings_to_urls': False}) as writer:
                if result_type == "all":
                    # Write in chunks for large datasets
                    if len(matched_df) > 0:
                        matched_df.to_excel(writer, sheet_name='Matched Records', index=False)
                    if len(unmatched_a_df) > 0:
                        unmatched_a_df.to_excel(writer, sheet_name='Unmatched FileA', index=False)
                    if len(unmatched_b_df) > 0:
                        unmatched_b_df.to_excel(writer, sheet_name='Unmatched FileB', index=False)

                    # Add summary sheet
                    summary_data = pd.DataFrame({
                        'Metric': ['Total Records FileA', 'Total Records FileB', 'Matched Records',
                                   'Unmatched FileA', 'Unmatched FileB', 'Match Percentage'],
                        'Count': [
                            results['row_counts']['unmatched_a'] + results['row_counts']['matched'],
                            results['row_counts']['unmatched_b'] + results['row_counts']['matched'],
                            results['row_counts']['matched'],
                            results['row_counts']['unmatched_a'],
                            results['row_counts']['unmatched_b'],
                            f"{(results['row_counts']['matched'] / max(results['row_counts']['unmatched_a'] + results['row_counts']['matched'], results['row_counts']['unmatched_b'] + results['row_counts']['matched'], 1) * 100):.2f}%"
                        ]
                    })
                    summary_data.to_excel(writer, sheet_name='Summary', index=False)

                elif result_type == "matched" and len(matched_df) > 0:
                    matched_df.to_excel(writer, sheet_name='Matched Records', index=False)
                elif result_type == "unmatched_a" and len(unmatched_a_df) > 0:
                    unmatched_a_df.to_excel(writer, sheet_name='Unmatched FileA', index=False)
                elif result_type == "unmatched_b" and len(unmatched_b_df) > 0:
                    unmatched_b_df.to_excel(writer, sheet_name='Unmatched FileB', index=False)

            output.seek(0)

            filename = f"reconciliation_{reconciliation_id}_{result_type}.xlsx"
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        elif format.lower() == "csv":
            # For CSV, return the requested result type
            if result_type == "matched":
                df_to_export = matched_df
            elif result_type == "unmatched_a":
                df_to_export = unmatched_a_df
            elif result_type == "unmatched_b":
                df_to_export = unmatched_b_df
            else:
                # For "all", combine all data
                df_to_export = pd.concat([
                    matched_df.assign(Result_Type='Matched'),
                    unmatched_a_df.assign(Result_Type='Unmatched_FileA'),
                    unmatched_b_df.assign(Result_Type='Unmatched_FileB')
                ], ignore_index=True)

            output = io.StringIO()
            df_to_export.to_csv(output, index=False)
            output.seek(0)

            # Convert to bytes for streaming
            output = io.BytesIO(output.getvalue().encode('utf-8'))
            filename = f"reconciliation_{reconciliation_id}_{result_type}.csv"
            media_type = "text/csv"

        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'excel' or 'csv'")

        return StreamingResponse(
            output,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")


@router.get("/results/{reconciliation_id}/summary")
async def get_reconciliation_summary(reconciliation_id: str):
    """Get a quick summary of reconciliation results"""

    results = optimized_reconciliation_storage.get_results(reconciliation_id)
    if not results:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    row_counts = results['row_counts']
    total_a = row_counts['unmatched_a'] + row_counts['matched']
    total_b = row_counts['unmatched_b'] + row_counts['matched']

    return {
        'reconciliation_id': reconciliation_id,
        'timestamp': results['timestamp'].isoformat(),
        'summary': {
            'total_records_file_a': total_a,
            'total_records_file_b': total_b,
            'matched_records': row_counts['matched'],
            'unmatched_file_a': row_counts['unmatched_a'],
            'unmatched_file_b': row_counts['unmatched_b'],
            'match_percentage': round((row_counts['matched'] / max(total_a, total_b, 1)) * 100, 2),
            'data_quality': {
                'file_a_match_rate': round((row_counts['matched'] / max(total_a, 1)) * 100, 2),
                'file_b_match_rate': round((row_counts['matched'] / max(total_b, 1)) * 100, 2),
                'overall_completeness': round(((total_a + total_b - row_counts['unmatched_a'] - row_counts[
                    'unmatched_b']) / max(total_a + total_b, 1)) * 100, 2)
            }
        }
    }


@router.delete("/results/{reconciliation_id}")
async def delete_reconciliation_results(reconciliation_id: str):
    """Delete reconciliation results to free up memory"""

    results = optimized_reconciliation_storage.get_results(reconciliation_id)
    if not results:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    # Remove from storage
    if reconciliation_id in optimized_reconciliation_storage.storage:
        del optimized_reconciliation_storage.storage[reconciliation_id]
        return {"success": True, "message": f"Reconciliation results {reconciliation_id} deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found in storage")


@router.get("/health")
async def reconciliation_health_check():
    """Health check for reconciliation service"""
    storage_count = len(optimized_reconciliation_storage.storage)

    return {
        "status": "healthy",
        "service": "optimized_reconciliation",
        "active_reconciliations": storage_count,
        "memory_usage": "optimized",
        "features": [
            "hash_based_matching",
            "vectorized_extraction",
            "column_selection",
            "paginated_results",
            "streaming_downloads",
            "batch_processing",
            "json_input_support",
            "file_id_retrieval"
        ]
    }