# backend/app/main.py - Updated with regex generation routes
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    title="Optimized Financial Data Extraction & Reconciliation API",
    version="4.1.0",
    description="High-performance AI-powered financial data extraction, comparison, and reconciliation with AI regex generation"
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
    logger.info("Starting Optimized File Processing API with AI Regex Generation")
    temp_dir = os.getenv("TEMP_DIR", "./temp")
    max_file_size = int(os.getenv("MAX_FILE_SIZE", "100"))

    logger.info(f"Temp directory: {temp_dir}")
    logger.info(f"Max file size: {max_file_size}MB")
    logger.info("Optimized for large datasets (50k-100k records)")
    logger.info("AI Regex Generation: ✅ Enabled")

    # Ensure temp directory exists
    os.makedirs(temp_dir, exist_ok=True)

    yield
    # Shutdown
    logger.info("Shutting down Optimized File Processing API")


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
    """Get enhanced templates with column selection examples"""
    templates = [
        {
            "name": "💰 Financial Transaction Reconciliation",
            "description": "Match financial transactions between two sources using amount, date, and reference matching",
            "user_requirements": "Please configure the reconciliation to match financial transactions between the two files.",
            "prompt": "Configure reconciliation for financial transactions with amount tolerance matching",
            "category": "reconciliation",
            "filesRequired": 2,
            "fileLabels": ["Primary Transactions", "Comparison Transactions"]
        },
        {
            "name": "🤖 AI File Generator",
            "description": "Generate new files from existing data using natural language prompts...",
            "category": "ai-generation",
            "filesRequired": 1,
            "fileLabels": ["Source File"],
            "user_requirements": "Describe the file you want to generate..."
        },
        {
            "name": "Delta Generation",
            "description": "Compare two versions of data to identify what changed between older and newer files. Identifies unchanged, amended, deleted, and newly added records.",
            "category": "delta-generation",
            "filesRequired": 2,
            "fileLabels": ["Older File", "Newer File"],
            "user_requirements": "Delta Generation Process Requirements:Compare yesterday's trade file with today's trade file using TradeID + Account as composite key, and monitor changes in Status, Amount, and Settlement fields.",
            "icon": "📊",
            "color": "orange"
        }
    ]

    return {
        "success": True,
        "message": "Enhanced templates with AI regex generation support",
        "data": templates
    }


@app.get("/debug/status")
async def debug_status():
    """Enhanced debug status with optimization metrics"""
    from app.services.reconciliation_service import optimized_reconciliation_storage

    return {
        "success": True,
        "message": "Optimized system debug info with AI regex generation",
        "data": {
            "uploaded_files_count": len(uploaded_files),
            "extractions_count": len(extractions),
            "comparisons_count": len(comparisons),
            "reconciliations_count": len(reconciliations),
            "optimized_reconciliations_count": len(optimized_reconciliation_storage.storage),
            "openai_configured": bool(OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder"),
            "current_batch_size": BATCH_SIZE,
            "openai_model": OPENAI_MODEL,
            "optimization_features": {
                "hash_based_matching": True,
                "vectorized_extraction": True,
                "pattern_caching": True,
                "streaming_downloads": True,
                "paginated_results": True,
                "column_selection": True,
                "memory_optimization": True,
                "ai_regex_generation": True
            },
            "performance_limits": {
                "recommended_max_rows": 100000,
                "max_file_size_mb": int(os.getenv("MAX_FILE_SIZE", "100")),
                "batch_processing_size": 1000
            },
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
                    "status": "completed",
                    "match_rate": rec_data.get('row_counts', {}).get('matched', 0) if rec_data else 0,
                    "optimization": "enabled",
                    "created": rec_data.get('timestamp', datetime.now()).isoformat()[:19] if rec_data else ""
                }
                for rec_id, rec_data in list(optimized_reconciliation_storage.storage.items())[-5:]
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
    from app.routes.viewer_routes import router as viewer_router
    from app.routes.file_routes import router as file_router
    from app.routes.regex_routes import router as regex_router
    from app.routes.file_generator import router as file_generator_router
    from app.routes.delta_routes import router as delta_router
    from app.routes.save_results_routes import router as save_results_router
    from app.routes.recent_results_routes import router as recent_results_router
    from app.routes.rule_management_routes import router as rule_management_router

    app.include_router(health_routes)
    app.include_router(reconciliation_router)
    app.include_router(viewer_router)
    app.include_router(file_router)
    app.include_router(regex_router)  # NEW: Include regex routes

    app.include_router(delta_router)

    app.include_router(save_results_router)

    app.include_router(recent_results_router)
    app.include_router(rule_management_router)

    app.include_router(file_generator_router)
    print("✅ All routes loaded successfully (optimized reconciliation + AI regex generation enabled)")
except ImportError as e:
    print(f"❌ Failed to load routes: {e}")


@app.get("/performance/metrics")
async def get_performance_metrics():
    """Get current performance metrics"""
    from app.services.reconciliation_service import optimized_reconciliation_storage

    active_reconciliations = len(optimized_reconciliation_storage.storage)

    return {
        "success": True,
        "data": {
            "active_reconciliations": active_reconciliations,
            "memory_usage": "optimized",
            "processing_mode": "high_performance",
            "features_enabled": [
                "hash_based_matching",
                "vectorized_operations",
                "pattern_caching",
                "streaming_io",
                "batch_processing",
                "column_selection",
                "ai_regex_generation"  # NEW feature
            ],
            "recommendations": {
                "optimal_batch_size": 1000,
                "max_concurrent_reconciliations": 5,
                "memory_cleanup_interval": "30_minutes"
            }
        }
    }


@app.on_event("startup")
async def startup_event():
    print("🚀 Optimized Financial Data Extraction, Analysis & Reconciliation API Started")
    print(f"📊 Storage initialized: {len(uploaded_files)} files, {len(extractions)} extractions")
    print(
        f"🤖 OpenAI: {'✅ Configured' if (OPENAI_API_KEY and OPENAI_API_KEY != 'sk-placeholder') else '❌ Not configured'}")
    print("⚡ High-Performance Features: ✅ Enabled")
    print("   • Hash-based matching for large datasets")
    print("   • Vectorized pattern extraction")
    print("   • Optimized memory management")
    print("   • Streaming downloads")
    print("   • Column selection support")
    print("   • Paginated result retrieval")
    print("   • AI-powered regex generation")  # NEW feature
    print("🔧 Optimized for: 50k-100k record datasets")
    print("📋 API Docs: http://localhost:8000/docs")


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting Optimized Financial Data Extraction & Reconciliation API")
    print(f"📊 Batch size: {BATCH_SIZE}")
    print(f"🤖 OpenAI Model: {OPENAI_MODEL}")
    print(f"🔑 OpenAI configured: {'✅' if (OPENAI_API_KEY and OPENAI_API_KEY != 'sk-placeholder') else '❌'}")
    print("⚡ Performance Optimizations: ✅ Enabled")
    print("🔗 Column Selection: ✅ Enabled")
    print("📊 Large Dataset Support: ✅ 50k-100k records")
    print("🧙 AI Regex Generation: ✅ Enabled")  # NEW feature
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
