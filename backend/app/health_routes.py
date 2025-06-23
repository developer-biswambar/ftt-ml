from datetime import datetime
import logging
import os

from app.storage import uploaded_files, extractions
from fastapi import APIRouter
from openai import AsyncOpenAI

# Get configuration from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))

# Setup logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder":
    try:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI client initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize OpenAI client: {e}")
else:
    print("⚠️ OpenAI client not initialized - check API key")

router = APIRouter()


# API Endpoints
@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
        "openai_configured": bool(OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder"),
        "multi_column_support": True,
        "batch_processing_enabled": True,
        "current_batch_size": BATCH_SIZE,
        "uploaded_files_count": len(uploaded_files),
        "extractions_count": len(extractions)
    }


@router.get("/config")
async def get_config():
    return {
        "success": True,
        "data": {
            "openai_configured": bool(OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder"),
            "openai_model": OPENAI_MODEL,
            "batch_size": BATCH_SIZE,
            "multi_column_support": True,
            "api_key_set": bool(OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder"),
            "api_key_preview": f"sk-...{OPENAI_API_KEY[-4:]}" if OPENAI_API_KEY else "Not set"
        }
    }
