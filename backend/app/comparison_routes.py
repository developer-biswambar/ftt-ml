# comparison_routes.py - File Comparison and Analysis Routes

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any

import pandas as pd
from app.storage import uploaded_files, comparisons
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

# Get configuration from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")

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


# Pydantic models for file comparison
class ColumnMapping(BaseModel):
    file_a_column: str
    file_b_column: str
    comparison_type: str = "exact"  # exact, fuzzy, semantic, numerical


class ComparisonRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    analysis_prompt: str = Field(..., description="Natural language prompt describing what to analyze")
    column_mappings: Optional[List[ColumnMapping]] = None
    join_columns: Optional[Dict[str, str]] = None  # {"file_a_col": "file_b_col"}
    comparison_mode: str = "ai_guided"  # ai_guided, manual_mapping, auto_detect


class AnalysisResult(BaseModel):
    comparison_id: str
    status: str
    summary: Dict[str, Any]
    findings: List[Dict[str, Any]]
    recommendations: List[str]
    created_at: str
    processing_time: float


# Create router
router = APIRouter(prefix="/api/v1/compare", tags=["comparison"])


async def analyze_with_openai(prompt: str, data_context: Dict) -> Dict:
    """Use OpenAI to analyze the relationship between two datasets"""

    system_prompt = """You are an expert data analyst specializing in financial data comparison and reconciliation.
You excel at finding patterns, discrepancies, and relationships between datasets.

Your analysis should include:
1. Key findings and patterns
2. Data quality issues or discrepancies
3. Statistical summaries
4. Specific examples of matches/mismatches
5. Actionable recommendations

Return your analysis as a structured JSON object with these keys:
{
    "summary": {
        "total_matches": number,
        "total_mismatches": number,
        "match_rate": percentage,
        "key_insights": ["insight1", "insight2"]
    },
    "findings": [
        {
            "type": "match|mismatch|pattern|anomaly",
            "description": "detailed description",
            "severity": "high|medium|low",
            "examples": [{"file_a_row": "...", "file_b_row": "...", "details": "..."}],
            "affected_rows": number
        }
    ],
    "column_analysis": {
        "column_name": {
            "data_type": "string|number|date",
            "unique_values": number,
            "null_percentage": number,
            "patterns_found": ["pattern1", "pattern2"]
        }
    },
    "recommendations": ["recommendation1", "recommendation2"]
}"""

    user_prompt = f"""
Analysis Request: {prompt}

Data Context:
- File A: {data_context['file_a_info']['filename']} ({data_context['file_a_info']['rows']} rows)
- File B: {data_context['file_b_info']['filename']} ({data_context['file_b_info']['rows']} rows)

File A Columns: {', '.join(data_context['file_a_info']['columns'])}
File B Columns: {', '.join(data_context['file_b_info']['columns'])}

Sample Data from File A:
{json.dumps(data_context['file_a_sample'], indent=2)}

Sample Data from File B:
{json.dumps(data_context['file_b_sample'], indent=2)}

Column Statistics:
{json.dumps(data_context['column_stats'], indent=2)}

Please analyze these datasets according to the user's request and provide comprehensive findings."""

    try:
        response = await openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        logger.error(f"OpenAI analysis error: {e}")
        raise


async def detect_column_relationships(df_a: pd.DataFrame, df_b: pd.DataFrame) -> List[Dict]:
    """Automatically detect potential relationships between columns"""

    relationships = []

    for col_a in df_a.columns:
        for col_b in df_b.columns:
            # Skip if columns are empty
            if df_a[col_a].dropna().empty or df_b[col_b].dropna().empty:
                continue

            # Check for exact name match
            if col_a.lower() == col_b.lower():
                relationships.append({
                    "file_a_column": col_a,
                    "file_b_column": col_b,
                    "relationship_type": "name_match",
                    "confidence": 0.9
                })
                continue

            # Check for partial name match
            if col_a.lower() in col_b.lower() or col_b.lower() in col_a.lower():
                relationships.append({
                    "file_a_column": col_a,
                    "file_b_column": col_b,
                    "relationship_type": "partial_name_match",
                    "confidence": 0.7
                })

            # Check for data type compatibility
            try:
                sample_a = df_a[col_a].dropna().head(100)
                sample_b = df_b[col_b].dropna().head(100)

                # Check if both columns contain similar data patterns
                if str(sample_a.dtype) == str(sample_b.dtype):
                    # Check for value overlap
                    set_a = set(sample_a.astype(str))
                    set_b = set(sample_b.astype(str))
                    overlap = len(set_a.intersection(set_b))

                    if overlap > min(len(set_a), len(set_b)) * 0.1:  # At least 10% overlap
                        relationships.append({
                            "file_a_column": col_a,
                            "file_b_column": col_b,
                            "relationship_type": "value_overlap",
                            "confidence": min(overlap / min(len(set_a), len(set_b)), 1.0),
                            "overlap_count": overlap
                        })
            except:
                pass

    # Sort by confidence
    relationships.sort(key=lambda x: x.get('confidence', 0), reverse=True)

    return relationships


async def compare_column_values(df_a: pd.DataFrame, df_b: pd.DataFrame,
                                col_a: str, col_b: str,
                                comparison_type: str = "exact") -> Dict:
    """Compare values between two columns"""

    values_a = df_a[col_a].dropna()
    values_b = df_b[col_b].dropna()

    result = {
        "column_a": col_a,
        "column_b": col_b,
        "comparison_type": comparison_type,
        "statistics": {
            "file_a_count": len(values_a),
            "file_b_count": len(values_b),
            "file_a_unique": values_a.nunique(),
            "file_b_unique": values_b.nunique()
        }
    }

    if comparison_type == "exact":
        set_a = set(values_a.astype(str))
        set_b = set(values_b.astype(str))

        result["matches"] = {
            "in_both": list(set_a.intersection(set_b))[:100],  # Limit to 100 examples
            "only_in_a": list(set_a - set_b)[:100],
            "only_in_b": list(set_b - set_a)[:100],
            "match_rate": len(set_a.intersection(set_b)) / len(set_a.union(set_b)) if set_a.union(set_b) else 0
        }

    elif comparison_type == "numerical":
        try:
            nums_a = pd.to_numeric(values_a, errors='coerce').dropna()
            nums_b = pd.to_numeric(values_b, errors='coerce').dropna()

            result["numerical_stats"] = {
                "file_a": {
                    "mean": float(nums_a.mean()),
                    "std": float(nums_a.std()),
                    "min": float(nums_a.min()),
                    "max": float(nums_a.max())
                },
                "file_b": {
                    "mean": float(nums_b.mean()),
                    "std": float(nums_b.std()),
                    "min": float(nums_b.min()),
                    "max": float(nums_b.max())
                }
            }
        except:
            result["numerical_stats"] = {"error": "Could not convert to numerical values"}

    return result


async def process_comparison(comparison_id: str, request: ComparisonRequest):
    """Process the file comparison asynchronously"""

    start_time = datetime.utcnow()

    try:
        # Update status
        comparisons[comparison_id]["status"] = "processing"

        # Get file data
        file_a_data = uploaded_files.get(request.file_a_id)
        file_b_data = uploaded_files.get(request.file_b_id)

        if not file_a_data or not file_b_data:
            raise ValueError("One or both files not found")

        df_a = file_a_data["data"]
        df_b = file_b_data["data"]

        # Prepare context for analysis
        data_context = {
            "file_a_info": {
                "filename": file_a_data["info"]["filename"],
                "rows": len(df_a),
                "columns": list(df_a.columns)
            },
            "file_b_info": {
                "filename": file_b_data["info"]["filename"],
                "rows": len(df_b),
                "columns": list(df_b.columns)
            },
            "file_a_sample": df_a.head(5).to_dict(orient='records'),
            "file_b_sample": df_b.head(5).to_dict(orient='records'),
            "column_stats": {}
        }

        # Calculate column statistics
        for col in df_a.columns:
            data_context["column_stats"][f"file_a_{col}"] = {
                "null_count": int(df_a[col].isna().sum()),
                "unique_count": int(df_a[col].nunique()),
                "dtype": str(df_a[col].dtype)
            }

        for col in df_b.columns:
            data_context["column_stats"][f"file_b_{col}"] = {
                "null_count": int(df_b[col].isna().sum()),
                "unique_count": int(df_b[col].nunique()),
                "dtype": str(df_b[col].dtype)
            }

        # Perform analysis based on mode
        if request.comparison_mode == "ai_guided":
            # Let AI analyze the data based on the prompt
            analysis_result = await analyze_with_openai(request.analysis_prompt, data_context)

            # Auto-detect relationships for additional context
            relationships = await detect_column_relationships(df_a, df_b)
            analysis_result["detected_relationships"] = relationships[:10]  # Top 10

        elif request.comparison_mode == "manual_mapping":
            # Use provided column mappings
            if not request.column_mappings:
                raise ValueError("Column mappings required for manual mode")

            comparison_results = []
            for mapping in request.column_mappings:
                result = await compare_column_values(
                    df_a, df_b,
                    mapping.file_a_column,
                    mapping.file_b_column,
                    mapping.comparison_type
                )
                comparison_results.append(result)

            analysis_result = {
                "summary": {
                    "columns_compared": len(request.column_mappings),
                    "comparison_results": comparison_results
                },
                "findings": [],
                "recommendations": ["Review the comparison results for each column pair"]
            }

        else:  # auto_detect mode
            # Automatically detect and compare similar columns
            relationships = await detect_column_relationships(df_a, df_b)

            # Compare top relationships
            comparison_results = []
            for rel in relationships[:5]:  # Top 5 relationships
                result = await compare_column_values(
                    df_a, df_b,
                    rel["file_a_column"],
                    rel["file_b_column"],
                    "exact"
                )
                result["relationship"] = rel
                comparison_results.append(result)

            analysis_result = {
                "summary": {
                    "auto_detected_relationships": len(relationships),
                    "relationships_analyzed": len(comparison_results)
                },
                "findings": comparison_results,
                "detected_relationships": relationships,
                "recommendations": ["Review auto-detected column relationships"]
            }

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Update comparison record
        comparisons[comparison_id].update({
            "status": "completed",
            "result": analysis_result,
            "completed_at": datetime.utcnow().isoformat(),
            "processing_time": processing_time
        })

        logger.info(f"Comparison {comparison_id} completed in {processing_time:.2f}s")

    except Exception as e:
        logger.error(f"Comparison failed for {comparison_id}: {e}")
        comparisons[comparison_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })


# API Routes

@router.post("/")
async def start_comparison(request: ComparisonRequest):
    """Start a new file comparison analysis"""

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
            "created_at": datetime.utcnow().isoformat()
        }

        # Start async processing
        asyncio.create_task(process_comparison(comparison_id, request))

        return {
            "success": True,
            "message": "Comparison analysis started",
            "data": {
                "comparison_id": comparison_id,
                "status": "processing",
                "estimated_time": "10-30 seconds"
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

    return {
        "success": True,
        "message": "Comparison details retrieved",
        "data": comparison
    }


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
            "data": {"status": comparison["status"]}
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
                "processing_time": comparison.get("processing_time", 0)
            },
            "results": comparison.get("result", {})
        }
    }


@router.get("/")
async def list_comparisons():
    """List all comparisons"""

    comparison_list = []
    for comp_id, comp_data in comparisons.items():
        comparison_list.append({
            "comparison_id": comp_id,
            "file_a": comp_data.get("file_a_name"),
            "file_b": comp_data.get("file_b_name"),
            "status": comp_data.get("status"),
            "created_at": comp_data.get("created_at"),
            "mode": comp_data.get("comparison_mode")
        })

    # Sort by creation date
    comparison_list.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "success": True,
        "message": f"Found {len(comparison_list)} comparisons",
        "data": {
            "comparisons": comparison_list,
            "total": len(comparison_list)
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

    # In a real implementation, this would generate CSV/Excel files
    # For now, return JSON
    return {
        "success": True,
        "message": f"Results exported as {format}",
        "data": comparison.get("result", {})
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
            ]
        },
        {
            "name": "Data Quality Check",
            "description": "Identify data quality issues between files",
            "prompt": "Analyze data quality between these files. Look for: missing values, format inconsistencies, duplicate records, and data type mismatches. Identify which file has better data quality and suggest improvements.",
            "suggested_mappings": []
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
            "suggested_mappings": []
        }
    ]

    return {
        "success": True,
        "message": "Analysis templates retrieved",
        "data": templates
    }