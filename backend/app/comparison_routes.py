import asyncio
import logging
import os
import uuid
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI

from app.services.comparison_service import ComparisonConfig, process_comparison_enhanced, ComparisonRequest
from app.storage import uploaded_files, comparisons

# Get configuration from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")

# Enhanced configuration


# Setup logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder":
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info("✅ OpenAI client initialized for comparisons")
    except Exception as e:
        logger.error(f"❌ Failed to initialize OpenAI client: {e}")

# Create router
router = APIRouter(prefix="/api/v1/compare", tags=["comparison"])


# API Routes

@router.post("/")
async def start_comparison(request: ComparisonRequest):
    """Start a new file comparison analysis with enhanced processing"""

    try:
        # Validate files exist
        if request.file_a_id not in uploaded_files:
            raise HTTPException(404, f"File A not found: {request.file_a_id}")

        if request.file_b_id not in uploaded_files:
            raise HTTPException(404, f"File B not found: {request.file_b_id}")

        # Create comparison ID
        comparison_id = str(uuid.uuid4())

        # Initialize comparison record
        comparisons[comparison_id] = {
            "comparison_id": comparison_id,
            "file_a_id": request.file_a_id,
            "file_b_id": request.file_b_id,
            "file_a_name": uploaded_files[request.file_a_id]["info"]["filename"],
            "file_b_name": uploaded_files[request.file_b_id]["info"]["filename"],
            "analysis_prompt": request.analysis_prompt,
            "comparison_mode": request.comparison_mode,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "enhanced_processing": True  # Flag for enhanced processing
        }

        # Start enhanced async processing
        asyncio.create_task(process_comparison_enhanced(comparison_id, request))

        return {
            "success": True,
            "message": "Enhanced comparison analysis started",
            "data": {
                "comparison_id": comparison_id,
                "status": "processing",
                "estimated_time": "30-60 seconds",
                "processing_features": [
                    "Full dataset pattern analysis",
                    "Intelligent sampling",
                    "Multi-pass processing",
                    "Confidence scoring"
                ]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting comparison: {e}")
        raise HTTPException(400, f"Failed to start comparison: {str(e)}")


@router.get("/{comparison_id}")
async def get_comparison_status(comparison_id: str):
    """Get status and results of a comparison"""

    if comparison_id not in comparisons:
        raise HTTPException(404, "Comparison not found")

    comparison = comparisons[comparison_id]

    # Include processing steps for transparency
    response_data = {
        "success": True,
        "message": "Comparison details retrieved",
        "data": comparison
    }

    # Add progress percentage if still processing
    if comparison["status"] == "processing" and "processing_steps" in comparison:
        total_steps = 6  # Total steps in enhanced processing
        completed_steps = len(comparison.get("processing_steps", []))
        response_data["data"]["progress_percentage"] = (completed_steps / total_steps) * 100

    return response_data


@router.get("/{comparison_id}/results")
async def get_comparison_results(comparison_id: str):
    """Get detailed results of a completed comparison"""

    if comparison_id not in comparisons:
        raise HTTPException(404, "Comparison not found")

    comparison = comparisons[comparison_id]

    if comparison["status"] != "completed":
        return {
            "success": False,
            "message": f"Comparison not completed. Status: {comparison['status']}",
            "data": {
                "status": comparison["status"],
                "progress": comparison.get("progress_percentage", 0)
            }
        }

    return {
        "success": True,
        "message": "Comparison results retrieved",
        "data": {
            "comparison_info": {
                "comparison_id": comparison_id,
                "file_a": comparison["file_a_name"],
                "file_b": comparison["file_b_name"],
                "analysis_prompt": comparison["analysis_prompt"],
                "mode": comparison["comparison_mode"],
                "processing_time": comparison.get("processing_time", 0),
                "rows_processed": comparison.get("rows_processed", {}),
                "enhanced_processing": comparison.get("enhanced_processing", False)
            },
            "results": comparison.get("result", {}),
            "confidence_scores": comparison.get("result", {}).get("confidence_scores", {}),
            "data_quality": comparison.get("result", {}).get("data_characteristics", {})
        }
    }


@router.get("/")
async def list_comparisons(skip: int = 0, limit: int = 20):
    """List all comparisons with pagination"""

    comparison_list = []
    for comp_id, comp_data in comparisons.items():
        comparison_list.append({
            "comparison_id": comp_id,
            "file_a": comp_data.get("file_a_name"),
            "file_b": comp_data.get("file_b_name"),
            "status": comp_data.get("status"),
            "created_at": comp_data.get("created_at"),
            "mode": comp_data.get("comparison_mode"),
            "enhanced": comp_data.get("enhanced_processing", False)
        })

    # Sort by creation date
    comparison_list.sort(key=lambda x: x["created_at"], reverse=True)

    # Apply pagination
    total = len(comparison_list)
    comparison_list = comparison_list[skip:skip + limit]

    return {
        "success": True,
        "message": f"Found {total} comparisons",
        "data": {
            "comparisons": comparison_list,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }


@router.post("/{comparison_id}/export")
async def export_comparison_results(comparison_id: str, format: str = "json"):
    """Export comparison results in different formats"""

    if comparison_id not in comparisons:
        raise HTTPException(404, "Comparison not found")

    comparison = comparisons[comparison_id]

    if comparison["status"] != "completed":
        raise HTTPException(400, "Comparison not completed")

    result_data = comparison.get("result", {})

    if format == "json":
        return result_data
    elif format == "csv":
        # Convert findings to CSV format
        findings = result_data.get("findings", [])
        if findings:
            df = pd.DataFrame(findings)
            csv_data = df.to_csv(index=False)
            return {
                "success": True,
                "message": "Results exported as CSV",
                "data": {"csv": csv_data}
            }

    return {
        "success": True,
        "message": f"Results exported as {format}",
        "data": result_data
    }


@router.get("/templates")
async def get_analysis_templates():
    """Get pre-defined analysis prompt templates"""

    templates = [
        {
            "name": "Trade Reconciliation",
            "description": "Compare trade data between two sources",
            "prompt": "Compare the trade records between these two files. Identify matching trades based on trade ID, ISIN, and amount. Find any discrepancies in dates, amounts, or missing trades. Pay special attention to currency differences and date format variations.",
            "suggested_mappings": [
                {"file_a_column": "Trade ID", "file_b_column": "Trade ID", "comparison_type": "exact"},
                {"file_a_column": "ISIN", "file_b_column": "ISIN", "comparison_type": "exact"},
                {"file_a_column": "Amount", "file_b_column": "Amount", "comparison_type": "numerical"}
            ],
            "advanced_options": {
                "VALIDATE_ON_FULL_DATASET": True,
                "MIN_SAMPLE_SIZE": 50
            }
        },
        {
            "name": "Data Quality Check",
            "description": "Identify data quality issues between files",
            "prompt": "Analyze data quality between these files. Look for: missing values, format inconsistencies, duplicate records, and data type mismatches. Identify which file has better data quality and suggest improvements.",
            "suggested_mappings": [],
            "advanced_options": {
                "DETECT_PATTERNS": True,
                "MAX_SAMPLE_SIZE": 100
            }
        },
        {
            "name": "Unstructured Data Analysis",
            "description": "Analyze files with poor column structure",
            "prompt": "These files may have unstructured or poorly labeled columns. First, identify what type of data each column contains. Then find relationships between the files. Extract structured information from text fields where possible.",
            "suggested_mappings": [],
            "advanced_options": {
                "STRATIFIED_SAMPLING": True,
                "PATTERN_CONFIDENCE_THRESHOLD": 0.6
            }
        },
        {
            "name": "Security Master Comparison",
            "description": "Compare security reference data",
            "prompt": "Compare security master data between files. Match securities by ISIN, CUSIP, or ticker. Identify discrepancies in security names, currencies, exchange codes, or other attributes. Highlight any securities present in one file but not the other.",
            "suggested_mappings": [
                {"file_a_column": "ISIN", "file_b_column": "ISIN", "comparison_type": "exact"},
                {"file_a_column": "Security Name", "file_b_column": "Security Name", "comparison_type": "fuzzy"}
            ]
        },
        {
            "name": "Transaction Matching",
            "description": "Match transactions across systems",
            "prompt": "Match transactions between the two files using flexible criteria. Consider transactions as potential matches even with small differences in amounts (up to 0.1%) or dates (within 2 days). Identify unmatched transactions and possible reasons.",
            "suggested_mappings": [],
            "advanced_options": {
                "VALIDATE_ON_FULL_DATASET": True
            }
        }
    ]

    return {
        "success": True,
        "message": "Analysis templates retrieved",
        "data": templates
    }


@router.get("/config")
async def get_comparison_config():
    """Get current comparison configuration"""

    config = ComparisonConfig()

    return {
        "success": True,
        "message": "Comparison configuration retrieved",
        "data": {
            "sampling": {
                "min_sample_size": config.MIN_SAMPLE_SIZE,
                "max_sample_size": config.MAX_SAMPLE_SIZE,
                "stratified_sampling": config.STRATIFIED_SAMPLING
            },
            "pattern_detection": {
                "enabled": config.DETECT_PATTERNS,
                "confidence_threshold": config.PATTERN_CONFIDENCE_THRESHOLD
            },
            "processing": {
                "max_tokens_per_request": config.MAX_TOKENS_PER_REQUEST,
                "chunk_size_for_large_files": config.CHUNK_SIZE_FOR_LARGE_FILES
            },
            "validation": {
                "validate_on_full_dataset": config.VALIDATE_ON_FULL_DATASET,
                "confidence_calculation": config.CONFIDENCE_CALCULATION
            }
        }
    }  # comparison_routes.py - Enhanced File Comparison and Analysis Routes
