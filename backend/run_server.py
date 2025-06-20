#!/usr/bin/env python3
"""
Fixed server starter with proper import handling
"""
import sys
from pathlib import Path


def main():
    print("🚀 Starting Financial Data Extraction API")
    print("=" * 50)

    # Get current directory
    current_dir = Path(__file__).parent.absolute()
    print(f"Current directory: {current_dir}")

    # Add to Python path
    if str(current_dir) not in sys.path:
        sys.path.insert(0, str(current_dir))

    # Check required files
    required_files = [
        'app/main.py',
        'app/config/settings.py',
        'app/models/schemas.py',
        'app/services/openai_service.py',
        'app/services/file_service.py',
        'app/services/extraction_service.py',
        'app/utils/financial_validators.py',
        '.env'
    ]

    missing_files = []
    for file_path in required_files:
        if not (current_dir / file_path).exists():
            missing_files.append(file_path)

    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        print("Please ensure all required files exist")
        return

    # Check .env file
    env_file = current_dir / '.env'
    try:
        with open(env_file, 'r') as f:
            env_content = f.read()
            if 'your_openai_api_key_here' in env_content or 'your_actual_openai_api_key_here' in env_content:
                print("⚠️  Please set your actual OpenAI API key in .env file")
                return
    except Exception as e:
        print(f"❌ Error reading .env file: {e}")
        return

    # Test imports before starting server
    print("Testing imports...")
    try:
        # Test basic imports
        from app.config.settings import settings
        print("✅ Settings imported")

        from app.models.schemas import ExtractionRequest
        print("✅ Models imported")

        # Test if OpenAI key is set
        if settings.OPENAI_API_KEY in ['sk-placeholder', '', None]:
            print("⚠️  OpenAI API key not properly set")
            return

        print("✅ All imports successful")

    except Exception as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return

    # Start server
    try:
        import uvicorn

        print("Starting server...")
        print("📋 API Docs: http://localhost:8000/docs")
        print("🔍 Health: http://localhost:8000/health")
        print("=" * 50)

        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            reload_dirs=[str(current_dir)],
            log_level="info"
        )

    except Exception as e:
        print(f"❌ Server error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
