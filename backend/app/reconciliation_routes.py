# reconciliation_routes.py - Generic LLM-based File Reconciliation Routes

import asyncio
import logging
import os
import uuid
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI

from app.services.reconciliation_service import ReconciliationRequest, process_reconciliation, analyze_file_schema, \
    FinancialPatternDetector
from app.storage import uploaded_files, reconciliations

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
        logger.info("✅ OpenAI client initialized for reconciliation")
    except Exception as e:
        logger.error(f"❌ Failed to initialize OpenAI client: {e}")

# Create router
router = APIRouter(prefix="/api/v1/reconcile", tags=["reconciliation"])

# Global storage for reconciliations (add to storage.py)
reconciliations = {}


# API Routes

@router.post("/")
async def start_reconciliation(request: ReconciliationRequest):
    """Start a new reconciliation process with generic financial data support"""
    try:
        # Validate files exist
        if request.file_a_id not in uploaded_files:
            raise HTTPException(404, f"File A not found: {request.file_a_id}")

        if request.file_b_id not in uploaded_files:
            raise HTTPException(404, f"File B not found: {request.file_b_id}")

        # Create reconciliation ID
        reconciliation_id = str(uuid.uuid4())

        # Initialize reconciliation record
        reconciliations[reconciliation_id] = {
            "reconciliation_id": reconciliation_id,
            "file_a_id": request.file_a_id,
            "file_b_id": request.file_b_id,
            "file_a_name": uploaded_files[request.file_a_id]["info"]["filename"],
            "file_b_name": uploaded_files[request.file_b_id]["info"]["filename"],
            "user_requirements": request.user_requirements,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }

        # Start async processing
        asyncio.create_task(process_reconciliation(reconciliation_id, request))

        return {
            "success": True,
            "message": "Reconciliation started",
            "data": {
                "reconciliation_id": reconciliation_id,
                "status": "processing"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting reconciliation: {e}")
        raise HTTPException(400, f"Failed to start reconciliation: {str(e)}")


@router.get("/{reconciliation_id}")
async def get_reconciliation_status(reconciliation_id: str):
    """Get reconciliation status and results"""

    if reconciliation_id not in reconciliations:
        raise HTTPException(404, "Reconciliation not found")

    reconciliation = reconciliations[reconciliation_id]

    return {
        "success": True,
        "message": "Reconciliation details retrieved",
        "data": reconciliation
    }


@router.get("/{reconciliation_id}/download/{file_type}")
async def download_reconciliation_results(reconciliation_id: str, file_type: str):
    """Download reconciliation results as CSV"""

    if reconciliation_id not in reconciliations:
        raise HTTPException(404, "Reconciliation not found")

    reconciliation = reconciliations[reconciliation_id]

    if reconciliation["status"] != "completed":
        raise HTTPException(400, "Reconciliation not completed")

    result = reconciliation.get("result", {})

    if file_type == "matched":
        df = pd.DataFrame(result.get("matched_records", []))
        filename = f"matched_records_{reconciliation_id}.csv"
    elif file_type == "unmatched_a":
        df = pd.DataFrame(result.get("unmatched_file_a", []))
        filename = f"unmatched_file_a_{reconciliation_id}.csv"
    elif file_type == "unmatched_b":
        df = pd.DataFrame(result.get("unmatched_file_b", []))
        filename = f"unmatched_file_b_{reconciliation_id}.csv"
    else:
        raise HTTPException(400, "Invalid file type. Choose: matched, unmatched_a, or unmatched_b")

    csv_data = df.to_csv(index=False)

    return {
        "success": True,
        "message": f"Generated {file_type} CSV",
        "data": {
            "filename": filename,
            "csv": csv_data
        }
    }


@router.get("/")
async def list_reconciliations(skip: int = 0, limit: int = 20):
    """List all reconciliations"""

    reconciliation_list = []
    for rec_id, rec_data in reconciliations.items():
        reconciliation_list.append({
            "reconciliation_id": rec_id,
            "file_a": rec_data.get("file_a_name"),
            "file_b": rec_data.get("file_b_name"),
            "status": rec_data.get("status"),
            "created_at": rec_data.get("created_at"),
            "match_rate": rec_data.get("result", {}).get("match_rate", 0) if rec_data.get(
                "status") == "completed" else None,
            "match_confidence": rec_data.get("result", {}).get("match_confidence_avg", 0) if rec_data.get(
                "status") == "completed" else None
        })

    # Sort by creation date
    reconciliation_list.sort(key=lambda x: x["created_at"], reverse=True)

    # Apply pagination
    total = len(reconciliation_list)
    reconciliation_list = reconciliation_list[skip:skip + limit]

    return {
        "success": True,
        "message": f"Found {total} reconciliations",
        "data": {
            "reconciliations": reconciliation_list,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }


@router.get("/templates")
async def get_reconciliation_templates():
    """Get pre-defined reconciliation templates for various financial data types"""

    templates = [
        {
            "name": "Generic Trade Reconciliation",
            "description": "Reconcile any trade data between two sources",
            "user_requirements": "Match trades based on available identifiers (trade ID, reference numbers, etc.). If amounts exist, ensure they are within 1% tolerance. Match dates if present. Identify any missing trades in either file.",
            "suggested_mappings": []
        },
        {
            "name": "Security Master Data",
            "description": "Reconcile security reference data with flexible identifier matching",
            "user_requirements": "Match securities using any available identifiers (ISIN, CUSIP, SEDOL, ticker, internal codes). Compare security names, currencies, exchanges, and other attributes. Flag discrepancies in static data.",
            "suggested_mappings": []
        },
        {
            "name": "Position/Holdings Reconciliation",
            "description": "Reconcile position or holdings data",
            "user_requirements": "Match positions by account/portfolio and security identifier. Compare quantities (must match exactly) and market values (allow 2% tolerance for pricing differences). Check for missing positions.",
            "suggested_mappings": []
        },
        {
            "name": "Cash/Balance Reconciliation",
            "description": "Reconcile cash balances or account balances",
            "user_requirements": "Match by account number or identifier. Compare balances with configurable tolerance. If multiple currencies, match by account and currency combination. Flag any significant discrepancies.",
            "suggested_mappings": []
        },
        {
            "name": "Transaction/Settlement Reconciliation",
            "description": "Reconcile transaction or settlement data",
            "user_requirements": "Match transactions by reference number or by combination of trade date, security, and amount. Check settlement status and dates. Identify failed or pending settlements.",
            "suggested_mappings": []
        },
        {
            "name": "Corporate Actions Reconciliation",
            "description": "Reconcile corporate action events and entitlements",
            "user_requirements": "Match by security identifier and event date. Compare event types, ratios, and payment amounts. Check for missing events or different event interpretations.",
            "suggested_mappings": []
        },
        {
            "name": "Pricing/Valuation Reconciliation",
            "description": "Reconcile pricing or valuation data",
            "user_requirements": "Match by security identifier and valuation date. Compare prices with tolerance for different price sources. Flag significant price differences or missing prices.",
            "suggested_mappings": []
        },
        {
            "name": "Risk/Exposure Reconciliation",
            "description": "Reconcile risk metrics or exposure data",
            "user_requirements": "Match by portfolio/account and risk factor. Compare exposure amounts, sensitivities, or risk metrics with appropriate tolerances. Identify missing risk data.",
            "suggested_mappings": []
        },
        {
            "name": "Regulatory Reporting Reconciliation",
            "description": "Reconcile data for regulatory reporting",
            "user_requirements": "Match by transaction ID or unique identifiers required for reporting. Ensure all mandatory fields match exactly. Flag any discrepancies that would cause regulatory issues.",
            "suggested_mappings": []
        },
        {
            "name": "Custom Multi-Criteria Matching",
            "description": "Complex reconciliation with multiple matching criteria",
            "user_requirements": "When no single unique identifier exists, match using combinations of fields (e.g., date + amount + description). Apply different tolerances to different field types. Use fuzzy matching for text fields.",
            "suggested_mappings": []
        }
    ]

    return {
        "success": True,
        "message": "Reconciliation templates retrieved",
        "data": templates
    }


@router.post("/analyze-columns")
async def analyze_column_compatibility(file_a_id: str, file_b_id: str):
    """Analyze column compatibility between two files before reconciliation"""

    try:
        # Validate files exist
        if file_a_id not in uploaded_files:
            raise HTTPException(404, f"File A not found: {file_a_id}")

        if file_b_id not in uploaded_files:
            raise HTTPException(404, f"File B not found: {file_b_id}")

        # Get file data
        df_a = uploaded_files[file_a_id]["data"]
        df_b = uploaded_files[file_b_id]["data"]

        # Initialize pattern detector
        detector = FinancialPatternDetector()

        # Analyze schemas
        schema_a = await analyze_file_schema(df_a, detector)
        schema_b = await analyze_file_schema(df_b, detector)

        # Find potential column matches
        potential_matches = []

        for col_a, details_a in schema_a["column_analysis"].items():
            for col_b, details_b in schema_b["column_analysis"].items():
                compatibility_score = 0
                reasons = []

                # Check name similarity
                if col_a.lower() == col_b.lower():
                    compatibility_score += 0.4
                    reasons.append("Exact column name match")
                elif any(term in col_a.lower() and term in col_b.lower() for term in col_a.lower().split('_')):
                    compatibility_score += 0.2
                    reasons.append("Partial column name match")

                # Check data type compatibility
                if details_a['statistics'].get('is_numeric') == details_b['statistics'].get('is_numeric'):
                    compatibility_score += 0.2
                    reasons.append("Same data type category")

                # Check pattern overlap
                patterns_a = set(details_a['patterns'].keys())
                patterns_b = set(details_b['patterns'].keys())
                common_patterns = patterns_a & patterns_b

                if common_patterns:
                    compatibility_score += 0.3
                    reasons.append(f"Common patterns: {', '.join(common_patterns)}")

                # Check uniqueness similarity
                unique_diff = abs(details_a['statistics']['unique_ratio'] - details_b['statistics']['unique_ratio'])
                if unique_diff < 0.1:
                    compatibility_score += 0.1
                    reasons.append("Similar uniqueness ratio")

                if compatibility_score > 0.3:
                    potential_matches.append({
                        "file_a_column": col_a,
                        "file_b_column": col_b,
                        "compatibility_score": round(compatibility_score, 2),
                        "reasons": reasons,
                        "file_a_patterns": list(patterns_a),
                        "file_b_patterns": list(patterns_b)
                    })

        # Sort by compatibility score
        potential_matches.sort(key=lambda x: x['compatibility_score'], reverse=True)

        return {
            "success": True,
            "message": "Column analysis completed",
            "data": {
                "file_a_columns": list(schema_a["columns"]),
                "file_b_columns": list(schema_b["columns"]),
                "potential_matches": potential_matches[:20],  # Top 20 matches
                "file_a_analysis": {col: details['patterns'] for col, details in schema_a["column_analysis"].items()},
                "file_b_analysis": {col: details['patterns'] for col, details in schema_b["column_analysis"].items()}
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing columns: {e}")
        raise HTTPException(400, f"Failed to analyze columns: {str(e)}")
