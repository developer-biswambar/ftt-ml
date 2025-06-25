# backend/app/routes/file_routes.py - Optimized for large files using dotenv
import logging
import os
import uuid
from datetime import datetime
import io

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.services.storage_service import uploaded_files

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
async def upload_file(
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...)
):
    """
    Upload file with unlimited rows - optimized for large files
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
                # Use optimized Excel reading
                df = pd.read_excel(
                    io.BytesIO(content),
                    engine='openpyxl' if file.filename.lower().endswith('.xlsx') else 'xlrd'
                )
        except Exception as e:
            logger.error(f"Error reading file {file.filename}: {str(e)}")
            raise HTTPException(400, f"Error reading file: {str(e)}")

        # Log processing results
        total_rows = len(df)
        total_cols = len(df.columns)
        logger.info(f"Successfully processed {file.filename}: {total_rows:,} rows, {total_cols} columns")

        file_info = {
            "file_id": file_id,
            "filename": file.filename,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "total_rows": total_rows,
            "total_columns": total_cols,
            "columns": list(df.columns),
            "upload_time": datetime.utcnow().isoformat(),
            "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()}
        }

        # Store in memory (consider using database for production with large files)
        uploaded_files[file_id] = {
            "info": file_info,
            "data": df
        }

        # Add cleanup task for very large files (optional)
        cleanup_threshold = int(os.getenv("LARGE_FILE_THRESHOLD", "100000"))
        if total_rows > cleanup_threshold:
            logger.info(f"Large file detected ({total_rows:,} rows). Consider implementing cleanup logic.")

        return {
            "success": True,
            "message": f"File uploaded successfully - {total_rows:,} rows processed",
            "data": file_info
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error for {file.filename}: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")


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