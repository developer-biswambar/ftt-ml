import io
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from app.models.transformation_models import (
    TransformationRequest,
    TransformationResult,
    TransformationConfig,
    TransformationTemplate,
    LLMAssistanceRequest,
    LLMAssistanceResponse,
    SourceFile
)
from app.services.transformation_service import TransformationEngine, transformation_storage
from app.utils.uuid_generator import generate_uuid

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/transformation", tags=["transformation"])


async def get_file_dataframe(file_ref: SourceFile) -> pd.DataFrame:
    """Get dataframe from file reference"""
    # Import here to avoid circular imports
    from app.services.storage_service import uploaded_files

    if file_ref.file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail=f"File {file_ref.file_id} not found")

    file_data = uploaded_files[file_ref.file_id]
    return file_data["data"]


@router.post("/process/", response_model=TransformationResult)
async def process_transformation(request: TransformationRequest):
    """Process data transformation based on configuration"""

    start_time = datetime.now()
    engine = TransformationEngine()

    try:
        # Load source files into dataframes
        source_data = {}
        for source_file in request.source_files:
            df = await get_file_dataframe(source_file)
            source_data[source_file.alias] = df
            logger.info(f"Loaded {source_file.alias}: {len(df)} rows")

        # Process transformation
        result_df, processing_info = engine.process_transformation(
            source_data,
            request.transformation_config,
            preview_only=request.preview_only,
            row_limit=request.row_limit
        )

        # Generate transformation ID
        transformation_id = generate_uuid('transform')
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()

        processing_info['processing_time'] = processing_time

        column_ids = [col.id for col in request.transformation_config.output_definition.columns]

        # Remove col ids from the result
        final_data_df = result_df.drop(column_ids, axis=1)

        # Store results if not preview
        if not request.preview_only:
            storage_success = transformation_storage.store_results(
                transformation_id,
                {
                    'data': final_data_df,
                    'config': request.transformation_config.dict(),
                    'processing_info': processing_info
                }
            )
            if not storage_success:
                logger.warning("Failed to store transformation results")

        # Get total input rows
        total_input_rows = sum(len(df) for df in source_data.values())

        # Prepare response
        response = TransformationResult(
            success=True,
            transformation_id=transformation_id,
            total_input_rows=total_input_rows,
            total_output_rows=len(result_df),
            processing_time_seconds=round(processing_time, 3),
            validation_summary=processing_info.get('validation_results', {}),
            warnings=processing_info.get('warnings', []),
            errors=processing_info.get('errors', [])
        )

        # Add preview data if requested
        if request.preview_only:
            response.preview_data = result_df.head(request.row_limit or 10).to_dict('records')

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transformation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/results/{transformation_id}")
async def get_transformation_results(
        transformation_id: str,
        page: Optional[int] = 1,
        page_size: Optional[int] = 1000
):
    """Get transformation results with pagination"""

    results = transformation_storage.get_results(transformation_id)
    if not results:
        raise HTTPException(status_code=404, detail="Transformation ID not found")

    df = results['results']['data']
    total_rows = len(df)

    # Calculate pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    # Get page data
    page_data = df.iloc[start_idx:end_idx].to_dict('records')

    return {
        'transformation_id': transformation_id,
        'timestamp': results['timestamp'].isoformat(),
        'total_rows': total_rows,
        'page': page,
        'page_size': page_size,
        'data': page_data,
        'has_more': end_idx < total_rows
    }


@router.get("/download/{transformation_id}")
async def download_transformation_results(
        transformation_id: str,
        format: str = "csv"
):
    """Download transformation results"""

    results = transformation_storage.get_results(transformation_id)
    if not results:
        raise HTTPException(status_code=404, detail="Transformation ID not found")

    df = results['results']['data']
    config = results['results']['config']

    try:
        if format.lower() == "csv":
            # Generate CSV
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)

            # Convert to bytes
            output_bytes = io.BytesIO(output.getvalue().encode('utf-8'))
            filename = f"transformation_{transformation_id}.csv"
            media_type = "text/csv"

        elif format.lower() == "excel":
            # Generate Excel
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, sheet_name='Transformed Data', index=False)

                # Add metadata sheet
                metadata = pd.DataFrame({
                    'Property': ['Transformation ID', 'Created At', 'Total Rows', 'Source Files'],
                    'Value': [
                        transformation_id,
                        results['timestamp'].isoformat(),
                        len(df),
                        ', '.join([f['alias'] for f in config.get('source_files', [])])
                    ]
                })
                metadata.to_excel(writer, sheet_name='Metadata', index=False)

            output.seek(0)
            output_bytes = output
            filename = f"transformation_{transformation_id}.xlsx"
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        elif format.lower() == "json":
            # Generate JSON
            json_data = df.to_json(orient='records', indent=2)
            output_bytes = io.BytesIO(json_data.encode('utf-8'))
            filename = f"transformation_{transformation_id}.json"
            media_type = "application/json"

        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv', 'excel', or 'json'")

        return StreamingResponse(
            output_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")


@router.post("/templates/", response_model=TransformationTemplate)
async def save_transformation_template(template: TransformationTemplate):
    """Save a transformation template for reuse"""

    # In a real implementation, this would save to a database
    # For now, we'll use in-memory storage
    if not hasattr(save_transformation_template, 'templates'):
        save_transformation_template.templates = {}

    template.id = generate_uuid('template')
    template.updated_at = datetime.now()
    save_transformation_template.templates[template.id] = template

    return template


@router.get("/templates/")
async def list_transformation_templates(
        category: Optional[str] = None,
        search: Optional[str] = None
):
    """List available transformation templates"""

    if not hasattr(save_transformation_template, 'templates'):
        return []

    templates = list(save_transformation_template.templates.values())

    # Filter by category
    if category:
        templates = [t for t in templates if t.category == category]

    # Search filter
    if search:
        search_lower = search.lower()
        templates = [
            t for t in templates
            if search_lower in t.name.lower() or
               (t.description and search_lower in t.description.lower()) or
               any(search_lower in tag.lower() for tag in t.tags)
        ]

    return templates


@router.get("/templates/{template_id}", response_model=TransformationTemplate)
async def get_transformation_template(template_id: str):
    """Get a specific transformation template"""

    if not hasattr(save_transformation_template, 'templates'):
        raise HTTPException(status_code=404, detail="Template not found")

    template = save_transformation_template.templates.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/assist/", response_model=LLMAssistanceResponse)
async def get_llm_assistance(request: LLMAssistanceRequest):
    """Get LLM assistance for transformation configuration"""

    # This is a placeholder for LLM integration
    # In production, this would call your LLM service

    try:
        if request.assistance_type == "suggest_mappings":
            # Analyze source columns and target schema to suggest mappings
            suggestions = []

            if request.source_columns and request.target_schema:
                # Simple heuristic matching for demo
                source_cols = []
                for file_alias, columns in request.source_columns.items():
                    for col in columns:
                        source_cols.append(f"{file_alias}.{col}")

                for target_col in request.target_schema.columns:
                    # Find best match
                    best_match = None
                    best_score = 0

                    for source_col in source_cols:
                        col_name = source_col.split('.')[-1].lower()
                        target_name = target_col.name.lower()

                        # Simple similarity check
                        if col_name == target_name:
                            best_match = source_col
                            best_score = 1.0
                        elif col_name in target_name or target_name in col_name:
                            if best_score < 0.7:
                                best_match = source_col
                                best_score = 0.7

                    if best_match:
                        suggestions.append({
                            'target_column': target_col.name,
                            'source': best_match,
                            'mapping_type': 'direct',
                            'confidence': best_score
                        })
                    else:
                        # Suggest static or computed mapping
                        suggestions.append({
                            'target_column': target_col.name,
                            'mapping_type': 'static',
                            'suggested_value': '',
                            'confidence': 0.3
                        })

            return LLMAssistanceResponse(
                suggestions=suggestions,
                confidence_scores={s['target_column']: s['confidence'] for s in suggestions},
                explanation="Mapping suggestions based on column name similarity"
            )

        elif request.assistance_type == "generate_transformation":
            # Generate transformation based on examples
            if request.examples:
                # Analyze examples to generate transformation
                return LLMAssistanceResponse(
                    suggestions=[{
                        'type': 'expression',
                        'formula': 'IF({value} > 0, "D", "C")',
                        'explanation': 'Based on examples, positive values map to "D", negative to "C"'
                    }],
                    confidence_scores={'transformation': 0.8}
                )

        elif request.assistance_type == "validate_output":
            # Validate output against requirements
            return LLMAssistanceResponse(
                suggestions=[],
                warnings=[
                    "Missing required field: TaxID",
                    "Date format should be DD/MM/YYYY"
                ],
                explanation="Validation based on common tax declaration requirements"
            )

        return LLMAssistanceResponse(
            suggestions=[],
            explanation="No assistance available for this request type"
        )

    except Exception as e:
        logger.error(f"LLM assistance error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Assistance error: {str(e)}")


@router.delete("/results/{transformation_id}")
async def delete_transformation_results(transformation_id: str):
    """Delete transformation results"""

    if transformation_storage.delete_results(transformation_id):
        return {"success": True, "message": f"Transformation {transformation_id} deleted"}
    else:
        raise HTTPException(status_code=404, detail="Transformation ID not found")


@router.get("/health")
async def transformation_health_check():
    """Health check for transformation service"""

    return {
        "status": "healthy",
        "service": "transformation",
        "features": [
            "flexible_row_generation",
            "advanced_column_mapping",
            "multi_file_support",
            "expression_evaluation",
            "template_system",
            "llm_assistance",
            "multiple_output_formats"
        ]
    }