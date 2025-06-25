import io
import uuid
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse

from app.models.recon_models import ReconciliationResponse, RulesConfig, ReconciliationSummary
from app.services.reconciliation_service import reconciliation_storage, FileProcessor

# Create router
router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


@router.post("/process", response_model=ReconciliationResponse)
async def process_reconciliation(
        fileA: UploadFile = File(...),
        fileB: UploadFile = File(...),
        rules: str = Form(...)
):
    """Process file reconciliation based on provided rules"""
    start_time = datetime.now()
    processor = FileProcessor()

    try:
        # Parse rules
        rules_config = RulesConfig.parse_raw(rules)

        # Validate we have rules for both files
        if len(rules_config.Files) != 2:
            raise HTTPException(status_code=400, detail="Rules must contain exactly 2 file configurations")

        # Read files
        file_rule_a = next((f for f in rules_config.Files if f.Name == "FileA"), None)
        file_rule_b = next((f for f in rules_config.Files if f.Name == "FileB"), None)

        if not file_rule_a or not file_rule_b:
            raise HTTPException(status_code=400, detail="Rules must contain configurations for 'FileA' and 'FileB'")

        df_a = processor.read_file(fileA, file_rule_a.SheetName)
        df_b = processor.read_file(fileB, file_rule_b.SheetName)

        # Validate rules against columns
        errors_a = processor.validate_rules_against_columns(df_a, file_rule_a)
        errors_b = processor.validate_rules_against_columns(df_b, file_rule_b)

        if errors_a or errors_b:
            processor.errors.extend(errors_a + errors_b)
            raise HTTPException(status_code=400, detail={"errors": processor.errors})

        # Process FileA
        for extract_rule in file_rule_a.Extract:
            df_a[extract_rule.ResultColumnName] = processor.extract_patterns(df_a, extract_rule)

        if file_rule_a.Filter:
            df_a = processor.apply_filters(df_a, file_rule_a.Filter)

        # Process FileB
        for extract_rule in file_rule_b.Extract:
            df_b[extract_rule.ResultColumnName] = processor.extract_patterns(df_b, extract_rule)

        if file_rule_b.Filter:
            df_b = processor.apply_filters(df_b, file_rule_b.Filter)

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

        # Perform reconciliation
        reconciliation_results = processor.reconcile_files(df_a, df_b, rules_config.ReconciliationRules)

        # Generate reconciliation ID
        recon_id = str(uuid.uuid4())

        # Store results
        reconciliation_storage[recon_id] = {
            'matched': reconciliation_results['matched'],
            'unmatched_file_a': reconciliation_results['unmatched_file_a'],
            'unmatched_file_b': reconciliation_results['unmatched_file_b'],
            'timestamp': datetime.now()
        }

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

        return ReconciliationResponse(
            success=True,
            summary=summary,
            reconciliation_id=recon_id,
            errors=processor.errors,
            warnings=processor.warnings
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/results/{reconciliation_id}")
async def get_reconciliation_results(reconciliation_id: str):
    """Get reconciliation results as JSON"""
    if reconciliation_id not in reconciliation_storage:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    results = reconciliation_storage[reconciliation_id]

    # Handle NaN and infinite values before converting to JSON
    def clean_dataframe(df):
        # Replace NaN with None (which becomes null in JSON)
        df = df.replace({np.nan: None})
        # Replace infinite values with None
        df = df.replace({np.inf: None, -np.inf: None})
        return df.to_dict(orient='records')

    return {
        'matched': clean_dataframe(results['matched']),
        'unmatched_file_a': clean_dataframe(results['unmatched_file_a']),
        'unmatched_file_b': clean_dataframe(results['unmatched_file_b']),
        'timestamp': results['timestamp'].isoformat()
    }


@router.get("/download/{reconciliation_id}")
async def download_reconciliation_results(
        reconciliation_id: str,
        format: str = "excel"
):
    """Download reconciliation results as Excel or CSV"""
    if reconciliation_id not in reconciliation_storage:
        raise HTTPException(status_code=404, detail="Reconciliation ID not found")

    results = reconciliation_storage[reconciliation_id]

    if format.lower() == "excel":
        # Create Excel file with multiple sheets
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            results['matched'].to_excel(writer, sheet_name='Matched Records', index=False)
            results['unmatched_file_a'].to_excel(writer, sheet_name='Unmatched FileA', index=False)
            results['unmatched_file_b'].to_excel(writer, sheet_name='Unmatched FileB', index=False)

            # Add summary sheet
            summary_data = {
                'Metric': ['Total Records FileA', 'Total Records FileB', 'Matched Records',
                           'Unmatched FileA', 'Unmatched FileB'],
                'Count': [
                    len(results['matched']) + len(results['unmatched_file_a']),
                    len(results['matched']) + len(results['unmatched_file_b']),
                    len(results['matched']),
                    len(results['unmatched_file_a']),
                    len(results['unmatched_file_b'])
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)

        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=reconciliation_{reconciliation_id}.xlsx"}
        )

    else:  # CSV format - return matched records only
        output = io.StringIO()
        results['matched'].to_csv(output, index=False)
        output.seek(0)

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reconciliation_{reconciliation_id}_matched.csv"}
        )
