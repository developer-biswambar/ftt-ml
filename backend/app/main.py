# backend/app/main.py - Updated to include viewer routes
# main.py - Main FastAPI Application
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
import io

import pandas as pd
from fastapi import FastAPI,Request, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from fastapi.middleware.cors import CORSMiddleware

from app.services.storage_service import uploaded_files, extractions, comparisons, reconciliations

# Load .env file
try:
    from dotenv import load_dotenv

    load_dotenv()
    print("✅ .env file loaded successfully")
except ImportError:
    print("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))

# Validate configuration
if not OPENAI_API_KEY or OPENAI_API_KEY == "sk-placeholder":
    print("❌ OPENAI_API_KEY not found in .env file")
else:
    print(f"✅ OpenAI API Key loaded (ends with: ...{OPENAI_API_KEY[-4:]})")

print(f"🤖 Model: {OPENAI_MODEL}")
print(f"📊 Batch Size: {BATCH_SIZE}")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Financial Data Extraction & Reconciliation API",
    version="3.0.0",
    description="AI-powered financial data extraction, comparison, and reconciliation with LLM-based rule generation and data viewer"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting File Processing API")
    temp_dir = os.getenv("TEMP_DIR", "./temp")
    max_file_size = int(os.getenv("MAX_FILE_SIZE", "100"))

    logger.info(f"Temp directory: {temp_dir}")
    logger.info(f"Max file size: {max_file_size}MB")
    logger.info("No row limits configured - unlimited file processing")

    # Ensure temp directory exists
    os.makedirs(temp_dir, exist_ok=True)

    yield
    # Shutdown
    logger.info("Shutting down File Processing API")


# Custom exception handler for large file processing
@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    debug_mode = os.getenv("DEBUG", "false").lower() == "true"

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error during file processing",
            "detail": str(exc) if debug_mode else "An error occurred"
        }
    )
@app.get("/templates")
async def get_templates():
    """Get single-column templates (backward compatibility)"""
    templates = [
        {
            "name": "ISIN Extraction",
            "prompt": "Extract ISIN codes from the text",
            "example": "Extract 12-character ISIN codes like US0378331005"
        },
        {
            "name": "Amount and Currency",
            "prompt": "Extract monetary amount and currency code",
            "example": "From 'USD 1,500,000' extract amount: 1500000, currency: USD"
        },
        {
            "name": "Trade Details",
            "prompt": "Extract trade reference, counterparty, and settlement date",
            "example": "Extract multiple trade-related fields"
        },
        {
            "name": "Multi-field Extraction",
            "prompt": "Extract ISIN, amount, currency, and trade reference from the text",
            "example": "Comprehensive extraction of multiple financial fields"
        }
    ]

    return {
        "success": True,
        "message": "Single-column templates retrieved",
        "data": templates
    }


@app.get("/debug/status")
async def debug_status():
    return {
        "success": True,
        "message": "System debug info",
        "data": {
            "uploaded_files_count": len(uploaded_files),
            "extractions_count": len(extractions),
            "comparisons_count": len(comparisons),
            "reconciliations_count": len(reconciliations),
            "openai_configured": bool(OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder"),
            "current_batch_size": BATCH_SIZE,
            "openai_model": OPENAI_MODEL,
            "multi_column_support": True,
            "reconciliation_support": True,
            "data_viewer_support": True,  # NEW
            "recent_extractions": [
                {
                    "id": ext_id[-8:],
                    "status": ext_data.get("status"),
                    "type": ext_data.get("extraction_type", "single_column"),
                    "columns": len(ext_data.get("column_rules", [])),
                    "created": ext_data.get("created_at", "")[:19]
                }
                for ext_id, ext_data in list(extractions.items())[-5:]
            ],
            "recent_reconciliations": [
                {
                    "id": rec_id[-8:],
                    "status": rec_data.get("status"),
                    "match_rate": rec_data.get("result", {}).get("match_rate", 0) if rec_data.get(
                        "status") == "completed" else None,
                    "created": rec_data.get("created_at", "")[:19]
                }
                for rec_id, rec_data in list(reconciliations.items())[-5:]
            ]
        }
    }


# Make storage available for other modules
import sys

sys.modules['app_storage'] = type(sys)('app_storage')
sys.modules['app_storage'].uploaded_files = uploaded_files
sys.modules['app_storage'].extractions = extractions
sys.modules['app_storage'].reconciliations = reconciliations

# Import and include routers
try:
    from app.routes.health_routes import router as health_routes
    from app.routes.reconciliation_routes import router as reconciliation_router
    from app.routes.viewer_routes import router as viewer_router  # NEW
    from app.routes.file_routes import router as file_router

    app.include_router(health_routes)
    app.include_router(reconciliation_router)
    app.include_router(viewer_router)

    app.include_router(file_router)# NEW
    print("✅ All routes loaded successfully")
except ImportError as e:
    print(f"❌ Failed to load routes: {e}")


@app.on_event("startup")
async def startup_event():
    print("🚀 Financial Data Extraction, Analysis & Reconciliation API Started")
    print(
        f"📊 Storage initialized: {len(uploaded_files)} files, {len(extractions)} extractions, {len(comparisons)} comparisons, {len(reconciliations)} reconciliations")
    print(
        f"🤖 OpenAI: {'✅ Configured' if (OPENAI_API_KEY and OPENAI_API_KEY != 'sk-placeholder') else '❌ Not configured'}")
    print("🔄 Multi-Column Processing: ✅ Enabled")
    print("🔍 File Comparison: ✅ Enabled")
    print("🔗 LLM-based Reconciliation: ✅ Enabled")
    print("📊 Data Viewer: ✅ Enabled")  # NEW
    print("📋 API Docs: http://localhost:8000/docs")


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting Financial Data Extraction & Reconciliation API")
    print(f"📊 Batch size: {BATCH_SIZE}")
    print(f"🤖 OpenAI Model: {OPENAI_MODEL}")
    print(f"🔑 OpenAI configured: {'✅' if (OPENAI_API_KEY and OPENAI_API_KEY != 'sk-placeholder') else '❌'}")
    print("🔄 Multi-Column Support: ✅ Enabled")
    print("🔗 LLM Reconciliation: ✅ Enabled")
    print("📊 Data Viewer: ✅ Enabled")  # NEW
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
