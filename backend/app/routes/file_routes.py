# backend/app/routes/file_routes.py - Enhanced with Excel sheet selection
import io
import logging
import os
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

import pandas as pd
from dotenv import load_dotenv
from fastapi import UploadFile, File, HTTPException, APIRouter, BackgroundTasks, Form
from pydantic import BaseModel

# Load environment variables
load_dotenv()

from app.services.storage_service import uploaded_files

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])

class FileIDsRequest(BaseModel):
    file_ids: List[str]  # Use UUID if you want validation, else use str
# Pydantic models for sheet handling
class SheetInfo(BaseModel):
    sheet_name: str
    row_count: int
    column_count: int
    columns: List[str]


class UpdateSheetRequest(BaseModel):
    sheet_name: str


def extract_excel_sheet_info(content: bytes, filename: str) -> List[SheetInfo]:
    """Extract information about all sheets in an Excel file"""
    try:
        # Read the Excel file to get all sheet names
        excel_file = pd.ExcelFile(io.BytesIO(content))
        sheet_info = []

        for sheet_name in excel_file.sheet_names:
            try:
                # Read each sheet to get metadata
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                sheet_info.append(SheetInfo(
                    sheet_name=sheet_name,
                    row_count=len(df),
                    column_count=len(df.columns),
                    columns=df.columns.tolist()
                ))
            except Exception as e:
                logger.warning(f"Could not read sheet '{sheet_name}' in {filename}: {str(e)}")

        return sheet_info
    except Exception as e:
        logger.error(f"Error extracting sheet information from {filename}: {str(e)}")
        return []


@router.post("/analyze-sheets")
async def analyze_excel_sheets(file: UploadFile = File(...)):
    """
    Analyze Excel file to get available sheets without uploading
    """
    try:
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            raise HTTPException(400, "Only Excel files are supported for sheet analysis")

        # Read content
        content = await file.read()

        # Extract sheet information
        sheet_info = extract_excel_sheet_info(content, file.filename)

        return {
            "success": True,
            "sheets": [sheet.dict() for sheet in sheet_info],
            "message": f"Found {len(sheet_info)} sheets"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing Excel sheets: {e}")
        return {
            "success": False,
            "error": str(e),
            "sheets": []
        }


@router.post("/validate-name")
async def validate_file_name(request: dict):
    """
    Validate if a filename is available
    """
    try:
        filename = request.get('filename', '').strip()

        if not filename:
            return {
                "isValid": False,
                "error": "Filename is required"
            }

        # Check if name already exists
        for file_id, file_data in uploaded_files.items():
            existing_name = file_data["info"].get("custom_name") or file_data["info"]["filename"]
            if existing_name.lower() == filename.lower():
                return {
                    "isValid": False,
                    "error": "A file with this name already exists"
                }

        return {
            "isValid": True,
            "message": "Filename is available"
        }

    except Exception as e:
        logger.error(f"Error validating filename: {e}")
        return {
            "isValid": False,
            "error": "Validation failed"
        }


@router.post("/upload")
async def upload_file(
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        sheet_name: str = Form(None),
        custom_name: str = Form(None)
):
    """
    Upload file with optional sheet selection and custom naming
    Enhanced with Excel sheet selection and file naming
    """
    try:
        if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(400, "Only CSV and Excel files are supported")

        # Get max file size from environment
        max_file_size = int(os.getenv("MAX_FILE_SIZE", "100")) * 1024 * 1024

        file_id = str(uuid.uuid4())

        # Log file upload start
        logger.info(f"Starting upload of file: {file.filename}")

        # Read content in chunks for large files
        content = await file.read()
        file_size = len(content)

        # Check file size limit
        if file_size > max_file_size:
            raise HTTPException(413, f"File too large. Maximum size: {max_file_size / (1024 * 1024):.1f}MB")

        logger.info(f"File size: {file_size / (1024 * 1024):.2f}MB")

        # Initialize variables
        is_excel = file.filename.lower().endswith(('.xlsx', '.xls'))
        df = None

        # Process file with optimized pandas settings
        try:
            if file.filename.lower().endswith('.csv'):
                # Use optimized CSV reading for large files
                df = pd.read_csv(
                    io.BytesIO(content),
                    low_memory=False,  # Don't infer dtypes chunk by chunk
                    encoding='utf-8'
                )
            else:
                # For Excel files, use specified sheet or default
                if sheet_name:
                    df = pd.read_excel(
                        io.BytesIO(content),
                        sheet_name=sheet_name,
                        engine='openpyxl'
                        # if file.filename.lower().endswith('.xlsx') else 'xlrd'
                    )
                else:
                    # Use first sheet if no sheet specified
                    df = pd.read_excel(
                        io.BytesIO(content),
                        engine='openpyxl'
                        # if file.filename.lower().endswith('.xlsx') else 'xlrd'
                    )

        except Exception as e:
            logger.error(f"Error reading file {file.filename}: {str(e)}")
            raise HTTPException(400, f"Error reading file: {str(e)}")

        # Log processing results
        total_rows = len(df)
        total_cols = len(df.columns)
        logger.info(f"Successfully processed {file.filename}: {total_rows:,} rows, {total_cols} columns")

        # Determine final filename
        final_filename = custom_name.strip() if custom_name else file.filename

        # Validate custom name if provided
        if custom_name:
            # Check if custom name already exists
            for existing_file_id, existing_file_data in uploaded_files.items():
                existing_name = existing_file_data["info"].get("custom_name") or existing_file_data["info"]["filename"]
                if existing_name.lower() == custom_name.strip().lower():
                    raise HTTPException(400, f"A file with the name '{custom_name}' already exists")

        file_info = {
            "file_id": file_id,
            "filename": file.filename,  # Original filename
            "custom_name": custom_name.strip() if custom_name else None,  # Custom display name
            "file_type": "excel" if is_excel else "csv",
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "total_rows": total_rows,
            "total_columns": total_cols,
            "columns": list(df.columns),
            "upload_time": datetime.utcnow().isoformat(),
            "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "sheet_name": sheet_name if sheet_name else None,  # Store selected sheet
        }

        # Store in memory
        uploaded_files[file_id] = {
            "info": file_info,
            "data": df
        }

        # Add cleanup task for very large files (optional)
        cleanup_threshold = int(os.getenv("LARGE_FILE_THRESHOLD", "100000"))
        if total_rows > cleanup_threshold:
            logger.info(f"Large file detected ({total_rows:,} rows). Consider implementing cleanup logic.")

        response_message = f"File uploaded successfully - {total_rows:,} rows processed"
        if sheet_name:
            response_message += f" from sheet '{sheet_name}'"
        if custom_name:
            response_message += f" with custom name '{custom_name}'"

        return {
            "success": True,
            "message": response_message,
            "data": file_info
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error for {file.filename}: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")


@router.get("/{file_id}/sheets")
async def get_file_sheets(file_id: str):
    """Get available sheets for an Excel file"""
    if file_id not in uploaded_files:
        raise HTTPException(404, "File not found")

    file_data = uploaded_files[file_id]
    file_info = file_data["info"]

    if not file_info.get("is_excel", False):
        raise HTTPException(400, "File is not an Excel file")

    return {
        "success": True,
        "data": {
            "file_id": file_id,
            "filename": file_info["filename"],
            "current_sheet": file_info.get("selected_sheet"),
            "available_sheets": file_info.get("available_sheets", [])
        }
    }


@router.post("/{file_id}/select-sheet")
async def select_sheet(file_id: str, request: UpdateSheetRequest):
    """Switch to a different sheet in an Excel file"""
    if file_id not in uploaded_files:
        raise HTTPException(404, "File not found")

    file_data = uploaded_files[file_id]
    file_info = file_data["info"]

    if not file_info.get("is_excel", False):
        raise HTTPException(400, "File is not an Excel file")

    # Check if requested sheet exists
    available_sheets = [sheet["sheet_name"] for sheet in file_info.get("available_sheets", [])]
    if request.sheet_name not in available_sheets:
        raise HTTPException(400, f"Sheet '{request.sheet_name}' not found. Available sheets: {available_sheets}")

    try:
        # Load the new sheet
        raw_content = file_data["raw_content"]
        df = pd.read_excel(
            io.BytesIO(raw_content),
            sheet_name=request.sheet_name,
            engine='openpyxl' if file_info["filename"].lower().endswith('.xlsx') else 'xlrd'
        )

        # Update stored data
        uploaded_files[file_id]["data"] = df
        uploaded_files[file_id]["info"]["selected_sheet"] = request.sheet_name
        uploaded_files[file_id]["info"]["total_rows"] = len(df)
        uploaded_files[file_id]["info"]["total_columns"] = len(df.columns)
        uploaded_files[file_id]["info"]["columns"] = list(df.columns)
        uploaded_files[file_id]["info"]["data_types"] = {col: str(dtype) for col, dtype in df.dtypes.items()}

        logger.info(
            f"Switched to sheet '{request.sheet_name}' for file {file_info['filename']}: {len(df):,} rows, {len(df.columns)} columns")

        return {
            "success": True,
            "message": f"Successfully switched to sheet '{request.sheet_name}'",
            "data": {
                "selected_sheet": request.sheet_name,
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "columns": list(df.columns)
            }
        }

    except Exception as e:
        logger.error(f"Error switching to sheet '{request.sheet_name}': {str(e)}")
        raise HTTPException(500, f"Failed to switch sheet: {str(e)}")


@router.get("/")
async def list_files():
    """List all uploaded files with enhanced information"""
    try:
        files = []
        total_rows = 0
        total_size_mb = 0

        for file_id, file_data in uploaded_files.items():
            file_info = file_data["info"].copy()
            files.append(file_info)
            total_rows += file_info.get("total_rows", 0)
            total_size_mb += file_info.get("file_size_mb", 0)

        return {
            "success": True,
            "message": f"Retrieved {len(files)} files",
            "data": {
                "files": files,
                "summary": {
                    "total_files": len(files),
                    "total_rows": total_rows,
                    "total_size_mb": round(total_size_mb, 2)
                }
            }
        }
    except Exception as e:
        logger.error(f"List files error: {e}")
        return {
            "success": False,
            "message": f"Failed to list files: {str(e)}",
            "data": {"files": [], "total_count": 0}
        }


@router.get("/{file_id}")
async def get_file_info(file_id: str, include_sample: bool = False, sample_rows: int = 10):
    """Get detailed information about a specific file"""
    if file_id not in uploaded_files:
        raise HTTPException(404, "File not found")

    file_data = uploaded_files[file_id]
    df = file_data["data"]

    response_data = {
        "info": file_data["info"],
    }

    if include_sample:
        # Get sample data (limited for large files)
        max_sample_rows = int(os.getenv("MAX_SAMPLE_ROWS", "100"))
        sample_data = df.head(min(sample_rows, max_sample_rows)).to_dict(orient='records')
        response_data["sample_data"] = sample_data

        # Enhanced column statistics
        column_stats = {}
        for col in df.columns:
            col_data = df[col]
            column_stats[col] = {
                "dtype": str(col_data.dtype),
                "null_count": int(col_data.isna().sum()),
                "null_percentage": round((col_data.isna().sum() / len(df)) * 100, 2),
                "unique_count": int(col_data.nunique()),
                "sample_values": col_data.dropna().head(5).astype(str).tolist()
            }

            # Add numeric statistics for numeric columns
            if pd.api.types.is_numeric_dtype(col_data):
                column_stats[col].update({
                    "min": float(col_data.min()) if not col_data.isna().all() else None,
                    "max": float(col_data.max()) if not col_data.isna().all() else None,
                    "mean": float(col_data.mean()) if not col_data.isna().all() else None
                })

        response_data["column_statistics"] = column_stats

    return {
        "success": True,
        "message": "File details retrieved",
        "data": response_data
    }


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """Delete a file from memory"""
    if file_id not in uploaded_files:
        raise HTTPException(404, "File not found")

    file_info = uploaded_files[file_id]["info"]
    del uploaded_files[file_id]

    logger.info(f"Deleted file: {file_info['filename']} ({file_info['total_rows']:,} rows)")

    return {
        "success": True,
        "message": f"File {file_info['filename']} deleted successfully"
    }
@router.post("/bulk-delete")
async def bulk_delete(request:FileIDsRequest):
    file_ids = request.file_ids

    for file_id in file_ids:
        await delete_file(file_id)


@router.get("/{file_id}/preview")
async def preview_file_data(
        file_id: str,
        start_row: int = 0,
        num_rows: int = 100,
        columns: str = None
):
    """Get a preview of file data with pagination"""
    if file_id not in uploaded_files:
        raise HTTPException(404, "File not found")

    df = uploaded_files[file_id]["data"]

    # Limit preview rows based on environment variable
    max_preview_rows = int(os.getenv("MAX_PREVIEW_ROWS", "1000"))
    num_rows = min(num_rows, max_preview_rows)

    # Parse columns if specified
    if columns:
        requested_cols = [col.strip() for col in columns.split(',')]
        available_cols = [col for col in requested_cols if col in df.columns]
        if available_cols:
            df = df[available_cols]

    # Apply pagination
    end_row = min(start_row + num_rows, len(df))
    preview_df = df.iloc[start_row:end_row]

    return {
        "success": True,
        "data": {
            "rows": preview_df.to_dict(orient='records'),
            "pagination": {
                "start_row": start_row,
                "end_row": end_row,
                "total_rows": len(df),
                "returned_rows": len(preview_df)
            }
        }
    }