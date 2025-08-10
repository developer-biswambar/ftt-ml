#!/usr/bin/env python3
"""
Test the upload API directly by importing and running the upload function
"""
import sys
import os
import asyncio
from unittest.mock import AsyncMock

# Add the backend directory to Python path
sys.path.insert(0, '/Users/biswambarpradhan/UpSkill/ftt-ml/backend')

# Now we can import the upload function
try:
    from app.routes.file_routes import upload_file
    from fastapi import UploadFile
    from fastapi.datastructures import FormData
    
    class MockUploadFile:
        def __init__(self, filename, content):
            self.filename = filename
            self.content = content
            
        async def read(self):
            return self.content.encode('utf-8')
    
    async def test_upload():
        """Test the upload function with our comprehensive test file"""
        
        # Read the comprehensive test file
        with open('/Users/biswambarpradhan/UpSkill/ftt-ml/comprehensive_test_file.csv', 'r') as f:
            file_content = f.read()
        
        # Create mock UploadFile
        mock_file = MockUploadFile('comprehensive_test_file.csv', file_content)
        
        # Create mock background tasks
        mock_background_tasks = AsyncMock()
        
        try:
            # Call the upload function
            result = await upload_file(
                background_tasks=mock_background_tasks,
                file=mock_file,
                sheet_name=None,
                custom_name=None
            )
            
            print("🎉 UPLOAD SUCCESS!")
            print(f"Message: {result['message']}")
            print(f"Success: {result['success']}")
            
            if 'cleanup_performed' in result:
                cleanup = result['cleanup_performed']
                print(f"\n📊 Cleanup Statistics:")
                print(f"  Empty content removed: {cleanup['empty_content_removed']}")
                print(f"  Original size: {cleanup['statistics']['original_size']}")
                print(f"  Final size: {cleanup['statistics']['final_size']}")
                print(f"  Removed rows: {cleanup['statistics']['removed_rows']}")
                print(f"  Removed columns: {cleanup['statistics']['removed_columns']}")
                
                if cleanup.get('warnings'):
                    print(f"\n⚠️  Warnings:")
                    for warning in cleanup['warnings']:
                        print(f"    {warning}")
                
                if cleanup.get('details'):
                    print(f"\n📋 Details:")
                    for detail in cleanup['details']:
                        print(f"    {detail}")
            
            return True
            
        except Exception as e:
            print(f"❌ UPLOAD FAILED: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    if __name__ == "__main__":
        print("Testing upload API with comprehensive test file...")
        success = asyncio.run(test_upload())
        if success:
            print("\n✅ Upload API test completed successfully!")
        else:
            print("\n💥 Upload API test failed!")

except ImportError as e:
    print(f"Import error: {e}")
    print("Cannot test upload API directly. Please start the server manually and test via HTTP.")