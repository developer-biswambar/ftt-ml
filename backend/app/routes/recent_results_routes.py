# backend/app/routes/recent_results_routes.py - Get Recent Delta and Reconciliation Results
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/recent-results", tags=["recent-results"])


class RecentResultInfo(BaseModel):
    """Information about a recent result"""
    id: str  # delta_id or reconciliation_id
    process_type: str  # 'delta' or 'reconciliation'
    status: str  # 'completed', 'processing', 'failed'
    created_at: str  # ISO datetime string
    file_a: Optional[str] = None
    file_b: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    processing_time_seconds: Optional[float] = None


class RecentResultsResponse(BaseModel):
    """Response model for recent results"""
    success: bool
    results: List[RecentResultInfo]
    total_count: int
    message: str


@router.get("/list", response_model=RecentResultsResponse)
async def get_recent_results(limit: int = 5):
    """Get recent Delta Generation and Reconciliation results"""

    try:
        recent_results = []

        # Get Delta Generation results
        try:
            from app.routes.delta_routes import delta_storage

            for delta_id, delta_data in delta_storage.items():
                # Get file information from storage
                file_a_name = "Unknown File A"
                file_b_name = "Unknown File B"

                try:
                    from app.services.storage_service import uploaded_files
                    # Try to find file names - this is a best effort
                    # In a real implementation, you'd store file references with results
                    files = list(uploaded_files.values())
                    if len(files) >= 2:
                        file_a_name = files[0]["info"].get("custom_name") or files[0]["info"]["filename"]
                        file_b_name = files[1]["info"].get("custom_name") or files[1]["info"]["filename"]
                except:
                    pass

                recent_results.append(RecentResultInfo(
                    id=delta_id,
                    process_type="delta",
                    status="completed",
                    created_at=delta_data["timestamp"].isoformat(),
                    file_a=file_a_name,
                    file_b=file_b_name,
                    summary={
                        "unchanged_records": delta_data["row_counts"]["unchanged"],
                        "amended_records": delta_data["row_counts"]["amended"],
                        "deleted_records": delta_data["row_counts"]["deleted"],
                        "newly_added_records": delta_data["row_counts"]["newly_added"]
                    },
                    processing_time_seconds=None  # Not stored in current delta structure
                ))

        except ImportError as e:
            logger.warning(f"Could not import delta storage: {e}")
        except Exception as e:
            logger.error(f"Error retrieving delta results: {e}")

        # Get Reconciliation results
        try:
            from app.services.reconciliation_service import optimized_reconciliation_storage

            for recon_id, recon_results in optimized_reconciliation_storage.storage.items():
                # Get file information
                file_a_name = "Unknown File A"
                file_b_name = "Unknown File B"

                try:
                    from app.services.storage_service import uploaded_files
                    files = list(uploaded_files.values())
                    if len(files) >= 2:
                        file_a_name = files[0]["info"].get("custom_name") or files[0]["info"]["filename"]
                        file_b_name = files[1]["info"].get("custom_name") or files[1]["info"]["filename"]
                except:
                    pass

                row_counts = recon_results.get("row_counts", {})
                total_a = row_counts.get("matched", 0) + row_counts.get("unmatched_a", 0)
                total_b = row_counts.get("matched", 0) + row_counts.get("unmatched_b", 0)
                match_percentage = 0
                if max(total_a, total_b) > 0:
                    match_percentage = round((row_counts.get("matched", 0) / max(total_a, total_b)) * 100, 2)

                recent_results.append(RecentResultInfo(
                    id=recon_id,
                    process_type="reconciliation",
                    status="completed",
                    created_at=recon_results["timestamp"].isoformat(),
                    file_a=file_a_name,
                    file_b=file_b_name,
                    summary={
                        "matched_records": row_counts.get("matched", 0),
                        "unmatched_file_a": row_counts.get("unmatched_a", 0),
                        "unmatched_file_b": row_counts.get("unmatched_b", 0),
                        "match_percentage": match_percentage,
                        "total_records_file_a": total_a,
                        "total_records_file_b": total_b
                    },
                    processing_time_seconds=None
                ))

        except ImportError as e:
            logger.warning(f"Could not import reconciliation storage: {e}")
        except Exception as e:
            logger.error(f"Error retrieving reconciliation results: {e}")

        # Sort by timestamp (newest first) and limit
        recent_results.sort(key=lambda x: x.created_at, reverse=True)
        limited_results = recent_results[:limit]

        return RecentResultsResponse(
            success=True,
            results=limited_results,
            total_count=len(recent_results),
            message=f"Retrieved {len(limited_results)} recent results"
        )

    except Exception as e:
        logger.error(f"Error getting recent results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recent results: {str(e)}")


@router.get("/delta/{delta_id}/summary")
async def get_delta_result_summary(delta_id: str):
    """Get summary for a specific delta result"""

    try:
        from app.routes.delta_routes import delta_storage

        if delta_id not in delta_storage:
            raise HTTPException(status_code=404, detail="Delta ID not found")

        delta_data = delta_storage[delta_id]
        row_counts = delta_data["row_counts"]

        return {
            "success": True,
            "delta_id": delta_id,
            "process_type": "delta",
            "status": "completed",
            "timestamp": delta_data["timestamp"].isoformat(),
            "summary": {
                "unchanged_records": row_counts["unchanged"],
                "amended_records": row_counts["amended"],
                "deleted_records": row_counts["deleted"],
                "newly_added_records": row_counts["newly_added"],
                "total_changes": row_counts["amended"] + row_counts["deleted"] + row_counts["newly_added"]
            }
        }

    except ImportError:
        raise HTTPException(status_code=500, detail="Delta storage not available")
    except Exception as e:
        logger.error(f"Error getting delta summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get delta summary: {str(e)}")


@router.get("/reconciliation/{recon_id}/summary")
async def get_reconciliation_result_summary(recon_id: str):
    """Get summary for a specific reconciliation result"""

    try:
        from app.services.reconciliation_service import optimized_reconciliation_storage

        recon_results = optimized_reconciliation_storage.get_results(recon_id)
        if not recon_results:
            raise HTTPException(status_code=404, detail="Reconciliation ID not found")

        row_counts = recon_results.get("row_counts", {})
        total_a = row_counts.get("matched", 0) + row_counts.get("unmatched_a", 0)
        total_b = row_counts.get("matched", 0) + row_counts.get("unmatched_b", 0)
        match_percentage = 0
        if max(total_a, total_b) > 0:
            match_percentage = round((row_counts.get("matched", 0) / max(total_a, total_b)) * 100, 2)

        return {
            "success": True,
            "reconciliation_id": recon_id,
            "process_type": "reconciliation",
            "status": "completed",
            "timestamp": recon_results["timestamp"].isoformat(),
            "summary": {
                "matched_records": row_counts.get("matched", 0),
                "unmatched_file_a": row_counts.get("unmatched_a", 0),
                "unmatched_file_b": row_counts.get("unmatched_b", 0),
                "match_percentage": match_percentage,
                "total_records_file_a": total_a,
                "total_records_file_b": total_b
            }
        }

    except ImportError:
        raise HTTPException(status_code=500, detail="Reconciliation storage not available")
    except Exception as e:
        logger.error(f"Error getting reconciliation summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get reconciliation summary: {str(e)}")


@router.delete("/clear-old")
async def clear_old_results(keep_count: int = 10):
    """Clear old results, keeping only the most recent ones"""

    try:
        deleted_count = 0

        # Clear old delta results
        try:
            from app.routes.delta_routes import delta_storage

            if len(delta_storage) > keep_count:
                # Sort by timestamp and keep only recent ones
                sorted_deltas = sorted(
                    delta_storage.items(),
                    key=lambda x: x[1]["timestamp"],
                    reverse=True
                )

                # Keep only the most recent
                to_keep = dict(sorted_deltas[:keep_count])
                to_delete = len(delta_storage) - len(to_keep)

                delta_storage.clear()
                delta_storage.update(to_keep)
                deleted_count += to_delete

        except ImportError:
            pass

        # Clear old reconciliation results
        try:
            from app.services.reconciliation_service import optimized_reconciliation_storage

            if len(optimized_reconciliation_storage.storage) > keep_count:
                # Sort by timestamp and keep only recent ones
                sorted_recons = sorted(
                    optimized_reconciliation_storage.storage.items(),
                    key=lambda x: x[1]["timestamp"],
                    reverse=True
                )

                # Keep only the most recent
                to_keep = dict(sorted_recons[:keep_count])
                to_delete = len(optimized_reconciliation_storage.storage) - len(to_keep)

                optimized_reconciliation_storage.storage.clear()
                optimized_reconciliation_storage.storage.update(to_keep)
                deleted_count += to_delete

        except ImportError:
            pass

        return {
            "success": True,
            "message": f"Cleared {deleted_count} old results, kept {keep_count} most recent",
            "deleted_count": deleted_count
        }

    except Exception as e:
        logger.error(f"Error clearing old results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear old results: {str(e)}")


@router.get("/health")
async def recent_results_health_check():
    """Health check for recent results service"""

    try:
        delta_count = 0
        recon_count = 0

        try:
            from app.routes.delta_routes import delta_storage
            delta_count = len(delta_storage)
        except ImportError:
            pass

        try:
            from app.services.reconciliation_service import optimized_reconciliation_storage
            recon_count = len(optimized_reconciliation_storage.storage)
        except ImportError:
            pass

        return {
            "status": "healthy",
            "service": "recent_results",
            "available_delta_results": delta_count,
            "available_reconciliation_results": recon_count,
            "total_results": delta_count + recon_count,
            "features": [
                "recent_results_listing",
                "cross_process_aggregation",
                "timestamp_sorting",
                "result_summaries",
                "old_results_cleanup"
            ]
        }

    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "error",
            "service": "recent_results",
            "error": str(e)
        }