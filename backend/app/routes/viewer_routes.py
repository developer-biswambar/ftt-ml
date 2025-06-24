# backend/app/routes/viewer_routes.py - New file for viewer API endpoints
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
import json
import io

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.storage_service import uploaded_files

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/files", tags=["viewer"])


# Pydantic models
class FileDataResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    current_page: int
    page_size: int
    total_pages: int


class UpdateFileDataRequest(BaseModel):
    data: Dict[str, Any]


@router.get("/{file_id}/data")
async def get_file_data(
        file_id: str,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(1000, ge=1, le=5000, description="Items per page")
):
    """Get paginated file data for the viewer"""
    try:
        if file_id not in uploaded_files:
            raise HTTPException(404, f"File {file_id} not found")

        file_data = uploaded_files[file_id]
        df = file_data["data"]

        # Calculate pagination
        total_rows = len(df)
        total_pages = (total_rows + page_size - 1) // page_size
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_rows)

        # Get paginated data
        paginated_df = df.iloc[start_idx:end_idx]

        # Convert to records (list of dicts)
        rows = []
        for _, row in paginated_df.iterrows():
            # Convert row to dict, handling NaN values
            row_dict = {}
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    row_dict[col] = ""
                elif isinstance(value, (int, float)):
                    row_dict[col] = value
                else:
                    row_dict[col] = str(value)
            rows.append(row_dict)

        return {
            "success": True,
            "message": f"Retrieved {len(rows)} rows from file",
            "data": FileDataResponse(
                columns=list(df.columns),
                rows=rows,
                total_rows=total_rows,
                current_page=page,
                page_size=page_size,
                total_pages=total_pages
            )
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving file data: {e}")
        raise HTTPException(500, f"Failed to retrieve file data: {str(e)}")


@router.put("/{file_id}/data")
async def update_file_data(file_id: str, request: UpdateFileDataRequest):
    """Update file data from the viewer"""
    try:
        if file_id not in uploaded_files:
            raise HTTPException(404, f"File {file_id} not found")

        # Extract updated data
        updated_data = request.data

        if 'rows' not in updated_data or 'columns' not in updated_data:
            raise HTTPException(400, "Missing 'rows' or 'columns' in request data")

        rows = updated_data['rows']
        columns = updated_data['columns']

        # Create new DataFrame from updated data
        df = pd.DataFrame(rows, columns=columns)

        # Update the stored file data
        uploaded_files[file_id]["data"] = df

        # Update file info
        file_info = uploaded_files[file_id]["info"]
        file_info["total_rows"] = len(df)
        file_info["columns"] = list(df.columns)
        file_info["last_modified"] = datetime.utcnow().isoformat()

        logger.info(f"Updated file {file_id} with {len(df)} rows and {len(df.columns)} columns")

        return {
            "success": True,
            "message": "File data updated successfully",
            "data": {
                "total_rows": len(df),
                "columns": len(df.columns),
                "last_modified": file_info["last_modified"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating file data: {e}")
        raise HTTPException(500, f"Failed to update file data: {str(e)}")


@router.get("/{file_id}/download")
async def download_modified_file(
        file_id: str,
        format: str = Query("csv", regex="^(csv|xlsx)$", description="File format")
):
    """Download the modified file in specified format"""
    try:
        if file_id not in uploaded_files:
            raise HTTPException(404, f"File {file_id} not found")

        file_data = uploaded_files[file_id]
        df = file_data["data"]
        file_info = file_data["info"]

        # Get base filename without extension
        base_filename = os.path.splitext(file_info["filename"])[0]

        if format.lower() == "csv":
            # Generate CSV
            output = io.StringIO()
            df.to_csv(output, index=False)
            csv_data = output.getvalue()
            output.close()

            filename = f"{base_filename}_modified.csv"

            return Response(
                content=csv_data,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )

        elif format.lower() == "xlsx":
            # Generate Excel
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Data')
            excel_data = output.getvalue()
            output.close()

            filename = f"{base_filename}_modified.xlsx"

            return Response(
                content=excel_data,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )

        else:
            raise HTTPException(400, f"Unsupported format: {format}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise HTTPException(500, f"Failed to download file: {str(e)}")


@router.get("/{file_id}/stats")
async def get_file_stats(file_id: str):
    """Get basic statistics about the file"""
    try:
        if file_id not in uploaded_files:
            raise HTTPException(404, f"File {file_id} not found")

        file_data = uploaded_files[file_id]
        df = file_data["data"]

        # Calculate basic statistics
        stats = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "memory_usage": df.memory_usage(deep=True).sum(),
            "column_types": df.dtypes.astype(str).to_dict(),
            "null_counts": df.isnull().sum().to_dict(),
            "numeric_columns": list(df.select_dtypes(include=['number']).columns),
            "text_columns": list(df.select_dtypes(include=['object']).columns),
            "datetime_columns": list(df.select_dtypes(include=['datetime']).columns)
        }

        # Add basic statistics for numeric columns
        numeric_stats = {}
        for col in stats["numeric_columns"]:
            try:
                col_stats = df[col].describe()
                numeric_stats[col] = {
                    "count": int(col_stats["count"]),
                    "mean": float(col_stats["mean"]) if not pd.isna(col_stats["mean"]) else None,
                    "std": float(col_stats["std"]) if not pd.isna(col_stats["std"]) else None,
                    "min": float(col_stats["min"]) if not pd.isna(col_stats["min"]) else None,
                    "max": float(col_stats["max"]) if not pd.isna(col_stats["max"]) else None,
                    "median": float(col_stats["50%"]) if not pd.isna(col_stats["50%"]) else None
                }
            except Exception:
                numeric_stats[col] = {"error": "Could not calculate statistics"}

        stats["numeric_statistics"] = numeric_stats

        return {
            "success": True,
            "message": "File statistics retrieved",
            "data": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file stats: {e}")
        raise HTTPException(500, f"Failed to get file statistics: {str(e)}")


@router.post("/{file_id}/validate")
async def validate_file_data(file_id: str):
    """Validate file data integrity"""
    try:
        if file_id not in uploaded_files:
            raise HTTPException(404, f"File {file_id} not found")

        file_data = uploaded_files[file_id]
        df = file_data["data"]

        validation_results = {
            "is_valid": True,
            "issues": [],
            "warnings": [],
            "summary": {
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "duplicate_rows": 0,
                "empty_rows": 0,
                "columns_with_all_nulls": []
            }
        }

        # Check for duplicate rows
        duplicate_count = df.duplicated().sum()
        validation_results["summary"]["duplicate_rows"] = int(duplicate_count)
        if duplicate_count > 0:
            validation_results["warnings"].append(f"Found {duplicate_count} duplicate rows")

        # Check for empty rows (all values are null or empty)
        empty_rows = df.isnull().all(axis=1).sum()
        validation_results["summary"]["empty_rows"] = int(empty_rows)
        if empty_rows > 0:
            validation_results["warnings"].append(f"Found {empty_rows} completely empty rows")

        # Check for columns with all null values
        all_null_columns = df.columns[df.isnull().all()].tolist()
        validation_results["summary"]["columns_with_all_nulls"] = all_null_columns
        if all_null_columns:
            validation_results["warnings"].append(f"Columns with all null values: {', '.join(all_null_columns)}")

        # Check data type consistency
        for col in df.columns:
            try:
                # Try to detect if numeric columns have been corrupted with text
                if df[col].dtype == 'object':
                    # Check if column contains mostly numeric values but has some text
                    non_null_values = df[col].dropna()
                    if len(non_null_values) > 0:
                        numeric_count = 0
                        for val in non_null_values:
                            try:
                                float(str(val))
                                numeric_count += 1
                            except ValueError:
                                pass

                        if numeric_count > 0.8 * len(non_null_values) and numeric_count < len(non_null_values):
                            validation_results["warnings"].append(
                                f"Column '{col}' appears to be mostly numeric but contains some text values"
                            )
            except Exception:
                pass

        return {
            "success": True,
            "message": "File validation completed",
            "data": validation_results
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating file: {e}")
        raise HTTPException(500, f"Failed to validate file: {str(e)}")