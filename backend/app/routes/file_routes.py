# backend/app/main.py - Updated to include viewer routes
# main.py - Main FastAPI Application
import logging
import os
import uuid
from datetime import datetime
import io

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from app.services.storage_service import uploaded_files
# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])



@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(400, "Only CSV and Excel files are supported")

        file_id = str(uuid.uuid4())
        content = await file.read()

        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))

        file_info = {
            "file_id": file_id,
            "filename": file.filename,
            "total_rows": len(df),
            "columns": list(df.columns),
            "upload_time": datetime.utcnow().isoformat()
        }

        uploaded_files[file_id] = {
            "info": file_info,
            "data": df
        }

        logger.info(f"File uploaded: {file.filename} with {len(df)} rows")

        return {
            "success": True,
            "message": "File uploaded successfully",
            "data": file_info
        }

    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(400, f"Upload failed: {str(e)}")


@router.get("/")
async def list_files():
    try:
        files = []
        for file_id, file_data in uploaded_files.items():
            file_info = file_data["info"].copy()
            files.append(file_info)

        return {
            "success": True,
            "message": f"Retrieved {len(files)} files",
            "data": {
                "files": files,
                "total_count": len(files)
            }
        }
    except Exception as e:
        logger.error(f"List files error: {e}")
        return {
            "success": False,
            "message": f"Failed to list files: {str(e)}",
            "data": {"files": [], "total_count": 0}
        }


@router.get("/files/{file_id}")
async def get_file_info(file_id: str):
    """Get detailed information about a specific file"""
    if file_id not in uploaded_files:
        raise HTTPException(404, "File not found")

    file_data = uploaded_files[file_id]
    df = file_data["data"]

    # Get sample data and statistics
    sample_data = df.head(10).to_dict(orient='records')

    column_stats = {}
    for col in df.columns:
        column_stats[col] = {
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isna().sum()),
            "unique_count": int(df[col].nunique()),
            "sample_values": df[col].dropna().head(5).tolist()
        }

    return {
        "success": True,
        "message": "File details retrieved",
        "data": {
            "info": file_data["info"],
            "sample_data": sample_data,
            "column_statistics": column_stats
        }
    }