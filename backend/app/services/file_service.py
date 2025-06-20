# backend/app/services/file_service.py
import pandas as pd
import uuid
import os
import tempfile
import logging
from typing import Dict, List, Any, Optional, Tuple
from fastapi import UploadFile, HTTPException
from app.config.settings import settings
from app.models.schemas import FileInfo, FileType
from datetime import datetime
import aiofiles

logger = logging.getLogger(__name__)

class FileProcessingService:
    def __init__(self):
        self.temp_dir = settings.TEMP_DIR
        self.max_file_size = settings.MAX_FILE_SIZE
        self.allowed_extensions = settings.ALLOWED_EXTENSIONS
        self.max_rows = settings.MAX_ROWS_PER_FILE
        
        # In-memory storage for file metadata (use database in production)
        self.file_registry: Dict[str, FileInfo] = {}
        self.file_data_cache: Dict[str, pd.DataFrame] = {}
    
    async def upload_and_process_file(self, file: UploadFile) -> FileInfo:
        """
        Upload and process Excel/CSV file
        """
        try:
            # Validate file
            self._validate_file(file)
            
            # Generate unique file ID
            file_id = str(uuid.uuid4())
            
            # Save file temporarily
            file_path = await self._save_temp_file(file, file_id)
            
            # Process file and extract metadata
            df, file_info = await self._process_file(file_path, file_id, file.filename)
            
            # Cache the dataframe for processing
            self.file_data_cache[file_id] = df
            
            # Store metadata
            self.file_registry[file_id] = file_info
            
            # Clean up temp file
            os.unlink(file_path)
            
            logger.info(f"Successfully processed file {file.filename} with ID {file_id}")
            return file_info
            
        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"File processing error: {str(e)}")
    
    def _validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file"""
        
        # Check file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in self.allowed_extensions:
            raise ValueError(f"Unsupported file type. Allowed: {', '.join(self.allowed_extensions)}")
        
        # Check file size (this is approximate, actual size check happens during upload)
        if hasattr(file, 'size') and file.size > self.max_file_size:
            raise ValueError(f"File too large. Maximum size: {self.max_file_size / (1024*1024):.1f}MB")
    
    async def _save_temp_file(self, file: UploadFile, file_id: str) -> str:
        """Save uploaded file to temporary location"""
        
        file_ext = os.path.splitext(file.filename)[1].lower()
        temp_path = os.path.join(self.temp_dir, f"{file_id}{file_ext}")
        
        async with aiofiles.open(temp_path, 'wb') as temp_file:
            content = await file.read()
            await temp_file.write(content)
        
        return temp_path
    
    async def _process_file(self, file_path: str, file_id: str, filename: str) -> Tuple[pd.DataFrame, FileInfo]:
        """Process the uploaded file and extract metadata"""
        
        try:
            # Determine file type
            file_ext = os.path.splitext(filename)[1].lower()
            
            if file_ext == '.csv':
                df = pd.read_csv(file_path, encoding='utf-8')
                file_type = FileType.CSV
            elif file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
                file_type = FileType.EXCEL
            else:
                raise ValueError(f"Unsupported file extension: {file_ext}")
            
            # Validate row count
            if len(df) > self.max_rows:
                raise ValueError(f"File has too many rows ({len(df)}). Maximum: {self.max_rows}")
            
            # Clean column names
            df.columns = df.columns.astype(str).str.strip()
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            # Create FileInfo object
            file_info = FileInfo(
                file_id=file_id,
                filename=filename,
                file_type=file_type,
                size=file_size,
                total_rows=len(df),
                columns=list(df.columns),
                upload_time=datetime.utcnow()
            )
            
            logger.info(f"Processed file: {filename}, Rows: {len(df)}, Columns: {len(df.columns)}")
            
            return df, file_info
            
        except Exception as e:
            logger.error(f"Error processing file {filename}: {str(e)}")
            raise
    
    def get_file_info(self, file_id: str) -> Optional[FileInfo]:
        """Get file information by ID"""
        return self.file_registry.get(file_id)
    
    def get_file_data(self, file_id: str) -> Optional[pd.DataFrame]:
        """Get file data by ID"""
        return self.file_data_cache.get(file_id)
    
    def get_column_sample(self, file_id: str, column_name: str, sample_size: int = 10) -> List[str]:
        """Get sample data from a specific column"""
        
        df = self.get_file_data(file_id)
        if df is None:
            raise ValueError(f"File with ID {file_id} not found")
        
        if column_name not in df.columns:
            raise ValueError(f"Column '{column_name}' not found in file")
        
        # Get non-null sample values
        column_data = df[column_name].dropna().astype(str)
        
        if len(column_data) == 0:
            return []
        
        # Return sample
        sample = column_data.head(sample_size).tolist()
        return sample
    
    def validate_extraction_request(self, file_id: str, source_column: str) -> bool:
        """Validate that extraction request is valid for the file"""
        
        file_info = self.get_file_info(file_id)
        if not file_info:
            raise ValueError(f"File with ID {file_id} not found")
        
        if source_column not in file_info.columns:
            raise ValueError(f"Column '{source_column}' not found in file. Available columns: {', '.join(file_info.columns)}")
        
        return True
    
    def prepare_data_for_extraction(self, file_id: str, source_column: str) -> List[str]:
        """Prepare data for extraction by cleaning and formatting"""
        
        df = self.get_file_data(file_id)
        if df is None:
            raise ValueError(f"File with ID {file_id} not found")
        
        # Get the source column data
        column_data = df[source_column].fillna('').astype(str)
        
        # Clean and filter the data
        cleaned_data = []
        for text in column_data:
            # Remove excessive whitespace
            text = ' '.join(text.split())
            
            # Skip empty or very short entries
            if len(text.strip()) > 3:
                cleaned_data.append(text.strip())
            else:
                cleaned_data.append('')  # Keep empty to maintain index alignment
        
        return cleaned_data
    
    def cleanup_file(self, file_id: str) -> bool:
        """Remove file from cache and registry"""
        try:
            if file_id in self.file_registry:
                del self.file_registry[file_id]
            
            if file_id in self.file_data_cache:
                del self.file_data_cache[file_id]
            
            logger.info(f"Cleaned up file with ID {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error cleaning up file {file_id}: {str(e)}")
            return False
    
    def get_all_files(self) -> List[FileInfo]:
        """Get all uploaded files"""
        return list(self.file_registry.values())

# Singleton instance
file_service = FileProcessingService()