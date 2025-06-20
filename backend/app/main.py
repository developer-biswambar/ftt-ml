# main.py - Main FastAPI Application

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime
import pandas as pd
import uuid
import os
from typing import Dict, Any
from storage import uploaded_files, extractions

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
    title="Financial Data Extraction API - Multi-Column",
    version="2.0.0",
    description="AI-powered financial data extraction with multi-column support and batch processing"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoints
@app.get("/health")
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

@app.get("/config")
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

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(400, "Only CSV and Excel files are supported")
        
        file_id = str(uuid.uuid4())
        content = await file.read()
        
        if file.filename.lower().endswith('.csv'):
            import io
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

@app.get("/files")
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

@app.get("/templates/multi-column")
async def get_multi_column_templates():
    """Get multi-column extraction templates"""
    templates = [
        {
            "name": "Financial Trade Analysis",
            "description": "Extract comprehensive trade information from multiple columns",
            "column_rules": [
                {
                    "column_name": "Description",
                    "extraction_prompt": "Extract ISIN, security name, and trade type from description",
                    "priority": 1
                },
                {
                    "column_name": "Comments", 
                    "extraction_prompt": "Extract counterparty, settlement date, and trade reference",
                    "priority": 2
                },
                {
                    "column_name": "Amount",
                    "extraction_prompt": "Extract monetary amount and currency code",
                    "priority": 3
                }
            ]
        },
        {
            "name": "Security Master Data",
            "description": "Extract security identification from multiple sources",
            "column_rules": [
                {
                    "column_name": "Security_Details",
                    "extraction_prompt": "Extract ISIN, CUSIP, and ticker symbol",
                    "priority": 1
                },
                {
                    "column_name": "Market_Info",
                    "extraction_prompt": "Extract exchange, market sector, and country code",
                    "priority": 2
                }
            ]
        },
        {
            "name": "Transaction Processing",
            "description": "Extract transaction details from trade and settlement columns",
            "column_rules": [
                {
                    "column_name": "Trade_Details",
                    "extraction_prompt": "Extract trade date, quantity, and price per unit",
                    "priority": 1
                },
                {
                    "column_name": "Settlement_Info",
                    "extraction_prompt": "Extract settlement date, fees, and net amount",
                    "priority": 2
                },
                {
                    "column_name": "Risk_Info",
                    "extraction_prompt": "Extract position type (long/short), leverage, and risk rating",
                    "priority": 3
                }
            ]
        }
    ]
    
    return {
        "success": True,
        "message": "Multi-column templates retrieved",
        "data": templates
    }

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
            "openai_configured": bool(OPENAI_API_KEY and OPENAI_API_KEY != "sk-placeholder"),
            "current_batch_size": BATCH_SIZE,
            "openai_model": OPENAI_MODEL,
            "multi_column_support": True,
            "recent_extractions": [
                {
                    "id": ext_id[-8:],
                    "status": ext_data.get("status"),
                    "type": ext_data.get("extraction_type", "single_column"),
                    "columns": len(ext_data.get("column_rules", [])),
                    "created": ext_data.get("created_at", "")[:19]
                }
                for ext_id, ext_data in list(extractions.items())[-5:]
            ]
        }
    }

# Make storage available for other modules
import sys
sys.modules['app_storage'] = type(sys)('app_storage')
sys.modules['app_storage'].uploaded_files = uploaded_files
sys.modules['app_storage'].extractions = extractions

# Import and include extraction routes
try:
    from extraction_routes import router as extraction_router
    app.include_router(extraction_router)
    print("✅ Extraction routes loaded successfully")
except ImportError as e:
    print(f"❌ Failed to load extraction routes: {e}")
    print("⚠️ Running without extraction functionality")

@app.on_event("startup")
async def startup_event():
    print("🚀 Financial Data Extraction API Started - Multi-Column Support")
    print(f"📊 Storage initialized: {len(uploaded_files)} files, {len(extractions)} extractions")
    print(f"🤖 OpenAI: {'✅ Configured' if (OPENAI_API_KEY and OPENAI_API_KEY != 'sk-placeholder') else '❌ Not configured'}")
    print("🔄 Multi-Column Processing: ✅ Enabled")
    print("📋 API Docs: http://localhost:8000/docs")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Financial Data Extraction API - Multi-Column")
    print(f"📊 Batch size: {BATCH_SIZE}")
    print(f"🤖 OpenAI Model: {OPENAI_MODEL}")
    print(f"🔑 OpenAI configured: {'✅' if (OPENAI_API_KEY and OPENAI_API_KEY != 'sk-placeholder') else '❌'}")
    print("🔄 Multi-Column Support: ✅ Enabled")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")