# # backend/app/config/settings.py
# import os
# from pydantic import BaseSettings
# from typing import Optional

# class Settings(BaseSettings):
#     # OpenAI Configuration
#     OPENAI_API_KEY: str
#     OPENAI_MODEL: str = "gpt-4-turbo"
#     OPENAI_MAX_TOKENS: int = 4000
#     OPENAI_TEMPERATURE: float = 0.1
    
#     # Application Settings
#     APP_NAME: str = "Financial Data Extraction API"
#     VERSION: str = "1.0.0"
#     DEBUG: bool = False
    
#     # File Processing
#     MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
#     ALLOWED_EXTENSIONS: list = ['.xlsx', '.xls', '.csv']
#     TEMP_DIR: str = "/tmp"
    
#     # Processing Settings
#     BATCH_SIZE: int = 100
#     MAX_ROWS_PER_FILE: int = 1000000
    
#     # Database (Optional - for storing results)
#     DATABASE_URL: Optional[str] = None
    
#     # Security
#     SECRET_KEY: str = "your-secret-key-here"
#     ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
#     # Logging
#     LOG_LEVEL: str = "INFO"
    
#     class Config:
#         env_file = ".env"
#         case_sensitive = True

# settings = Settings()

