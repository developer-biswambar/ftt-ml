# tests/conftest.py
import pytest
import pandas as pd
import io
import os
import tempfile
from fastapi.testclient import TestClient
from unittest.mock import patch
from typing import Dict, Any

# Import your FastAPI routers
from fastapi import FastAPI
from app.routes.file_routes import router as file_router
from app.routes.viewer_routes import router as viewer_router

# Mock storage for testing
test_uploaded_files: Dict[str, Dict[str, Any]] = {}


@pytest.fixture(scope="session")
def app():
    """Create FastAPI app instance for testing"""
    test_app = FastAPI(title="Test App")
    test_app.include_router(file_router)
    test_app.include_router(viewer_router)
    return test_app


@pytest.fixture
def client(app):
    """Create test client"""
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_storage():
    """Mock the storage service for all tests"""
    # Patch both the original module and the imported reference
    with patch('app.services.storage_service.uploaded_files', test_uploaded_files), \
            patch('app.routes.file_routes.uploaded_files', test_uploaded_files), \
            patch('app.routes.viewer_routes.uploaded_files', test_uploaded_files):
        test_uploaded_files.clear()  # Clear storage before each test
        yield test_uploaded_files


@pytest.fixture
def sample_csv_content():
    """Create sample CSV content"""
    return """name,age,city,salary
John Doe,25,New York,50000
Jane Smith,30,Los Angeles,60000
Bob Johnson,35,Chicago,55000
Alice Brown,28,Houston,52000
Charlie Wilson,32,Phoenix,58000"""


@pytest.fixture
def sample_csv_file(sample_csv_content):
    """Create sample CSV file object"""
    return io.BytesIO(sample_csv_content.encode('utf-8'))


@pytest.fixture
def large_csv_content():
    """Create large CSV content for testing file size limits"""
    header = "id,name,value,description\n"
    rows = []
    for i in range(10000):  # 10k rows
        rows.append(f"{i},Name_{i},{i * 100},Description for item {i}")
    return header + "\n".join(rows)


@pytest.fixture
def large_csv_file(large_csv_content):
    """Create large CSV file object"""
    return io.BytesIO(large_csv_content.encode('utf-8'))


@pytest.fixture
def sample_excel_file():
    """Create sample Excel file with multiple sheets"""
    # Create Excel file in memory
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: Sales data
        sales_data = pd.DataFrame({
            'product': ['Product A', 'Product B', 'Product C', 'Product D'],
            'sales': [1000, 1500, 800, 1200],
            'region': ['North', 'South', 'East', 'West']
        })
        sales_data.to_excel(writer, sheet_name='Sales', index=False)

        # Sheet 2: Employee data
        employee_data = pd.DataFrame({
            'employee_id': [1, 2, 3, 4, 5],
            'name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
            'department': ['HR', 'IT', 'Finance', 'IT', 'HR'],
            'salary': [55000, 65000, 60000, 70000, 58000]
        })
        employee_data.to_excel(writer, sheet_name='Employees', index=False)

        # Sheet 3: Empty sheet
        empty_data = pd.DataFrame()
        empty_data.to_excel(writer, sheet_name='Empty', index=False)

    output.seek(0)
    return output


@pytest.fixture
def invalid_file():
    """Create invalid file (not CSV or Excel)"""
    return io.BytesIO(b"This is not a valid CSV or Excel file content")


@pytest.fixture
def corrupted_excel_file():
    """Create corrupted Excel file"""
    return io.BytesIO(b"PK\x03\x04\x14\x00corrupted excel content")


@pytest.fixture
def empty_csv_file():
    """Create empty CSV file"""
    return io.BytesIO(b"")


@pytest.fixture
def csv_with_special_chars():
    """Create CSV with special characters and edge cases"""
    content = """name,description,value
"John, Jr.",Product with "quotes",100.50
Jane's Item,"Line 1
Line 2",200
Special Chars,Café & Résumé,300.75"""
    return io.BytesIO(content.encode('utf-8'))


@pytest.fixture
def mock_env_vars():
    """Mock environment variables for testing"""
    env_vars = {
        'MAX_FILE_SIZE': '10',  # 10MB for testing
        'MAX_SAMPLE_ROWS': '50',
        'MAX_PREVIEW_ROWS': '100',
        'LARGE_FILE_THRESHOLD': '1000'
    }

    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def sample_file_data():
    """Create sample file data for testing responses"""
    return {
        "file_id": "test-file-id-123",
        "filename": "test.csv",
        "custom_name": None,
        "file_type": "csv",
        "file_size_mb": 0.001,
        "total_rows": 5,
        "total_columns": 4,
        "columns": ["name", "age", "city", "salary"],
        "upload_time": "2025-07-15T10:00:00",
        "data_types": {
            "name": "object",
            "age": "int64",
            "city": "object",
            "salary": "int64"
        },
        "sheet_name": None
    }


@pytest.fixture
def uploaded_file_with_data(sample_file_data, sample_csv_content):
    """Create uploaded file entry with data"""
    df = pd.read_csv(io.StringIO(sample_csv_content))
    file_entry = {
        "info": sample_file_data,
        "data": df
    }
    test_uploaded_files[sample_file_data["file_id"]] = file_entry
    return file_entry


# Pytest markers for organizing tests
pytest_markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "slow: Slow tests that take more time",
    "file_upload: File upload related tests",
    "excel: Excel file specific tests",
    "csv: CSV file specific tests",
    "error: Error handling tests",
    "validation: Validation tests",
    "viewer: File viewer related tests"
]


def pytest_configure(config):
    """Configure pytest markers"""
    for marker in pytest_markers:
        config.addinivalue_line("markers", marker)