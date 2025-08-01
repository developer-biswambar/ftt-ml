# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a financial data processing platform with React frontend and FastAPI backend, designed for high-performance financial data extraction, reconciliation, and transformation. The system handles large datasets (50k-100k records) with AI-powered features including regex generation and automated reconciliation.

## Development Commands

### Backend (Python/FastAPI)
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Alternative direct run
python app/main.py

# Run tests with the custom test runner
python test/run_tests.py --coverage

# Run specific test categories
python test/run_tests.py -m file_upload    # File upload tests
python test/run_tests.py -m viewer         # Viewer tests
python test/run_tests.py -m error          # Error handling tests

# Run with coverage report
python test/run_tests.py --coverage --html-report

# Run specific test file
python test/run_tests.py -f test_file_routes.py

# Run tests in parallel
python test/run_tests.py --parallel

# Basic pytest commands
pytest -v                                  # All tests verbose
pytest --cov=app --cov-report=html        # Coverage with HTML report
```

### Frontend (React/Vite)
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview build
npm run preview
```

## Architecture Overview

### Backend Structure
- **FastAPI Application**: High-performance async API with CORS enabled
- **Modular Route System**: Organized by functionality (reconciliation, transformation, delta, etc.)
- **Service Layer**: Business logic separated into services (file_service, reconciliation_service, etc.)
- **Storage Layer**: In-memory storage with optimization for large datasets
- **AI Integration**: OpenAI integration for regex generation and intelligent processing

### Key Backend Components
- `app/main.py` - FastAPI application setup with all route inclusions
- `app/routes/` - API endpoints organized by feature
- `app/services/` - Business logic and external service integrations
- `app/models/` - Pydantic models for request/response validation
- `app/utils/` - Utility functions and validators

### Frontend Structure
- **React 19 + Vite**: Modern React setup with fast development server
- **Component Architecture**: Organized by feature areas (core, delta, recon, transformation, etc.)
- **Service Layer**: API communication services for each backend feature
- **State Management**: Custom hooks for application state
- **Routing**: React Router for navigation

### Key Frontend Components
- `src/components/core/` - Core UI components (ChatInterface, Sidebars)
- `src/components/[feature]/` - Feature-specific components
- `src/services/` - API service layers
- `src/hooks/` - Custom React hooks
- `src/pages/` - Main page components

## Core Features

### 1. Financial Data Reconciliation
- **Purpose**: Match financial transactions between two data sources
- **Key Files**: `reconciliation_routes.py`, `reconciliation_service.py`, `ReconciliationFlow.jsx`
- **Capabilities**: Exact matching, tolerance matching, multi-rule reconciliation

### 2. Data Transformation
- **Purpose**: Transform and restructure financial data
- **Key Files**: `transformation_routes.py`, `transformation_service.py`, `TransformationFlow.jsx`
- **Capabilities**: Column mapping, schema definition, row generation

### 3. Delta Generation
- **Purpose**: Compare file versions to identify changes
- **Key Files**: `delta_routes.py`, `DeltaGenerationFlow.jsx`
- **Capabilities**: Track unchanged, amended, deleted, and new records

### 4. AI-Powered Features
- **Regex Generation**: AI-generated patterns for data extraction
- **Intelligent Processing**: OpenAI integration for advanced data processing
- **Key Files**: `ai_assistance.py`, `openai_service.py`

### 5. File Management
- **Purpose**: Upload, process, and manage data files
- **Key Files**: `file_routes.py`, `file_service.py`, `FileUploadModal.jsx`
- **Supported Formats**: CSV, Excel (xlsx, xls)

## Configuration

### Environment Variables
Create `.env` file in backend directory with:
```
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo
BATCH_SIZE=20
MAX_FILE_SIZE=100
TEMP_DIR=./temp
DEBUG=false
```

### Testing Configuration
- **Test Framework**: pytest with custom markers
- **Coverage**: Configured for 80% minimum coverage
- **Test Categories**: unit, integration, file_upload, excel, csv, error, validation, viewer
- **Parallel Execution**: Available with pytest-xdist
- **Organized Testing**: Comprehensive testing documentation in `backend/docs/testing/`
  - Feature-specific test folders (reconciliation, transformation, delta, ai-features, file-processing)
  - Complete test scenarios with sample data and expected results
  - Performance benchmarks and validation criteria

## Performance Optimizations

The system is optimized for handling large financial datasets:

### Backend Optimizations
- **Hash-based Matching**: Fast lookups for reconciliation
- **Vectorized Operations**: Pandas optimization for data processing
- **Pattern Caching**: Regex pattern caching for repeated operations
- **Streaming I/O**: Memory-efficient file processing
- **Batch Processing**: Configurable batch sizes for large datasets

### Memory Management
- **Optimized Storage**: In-memory storage with cleanup
- **Column Selection**: Process only required columns
- **Paginated Results**: Stream large result sets

## Sample Data and Testing

### Test Data Location
- `backend/sample_data/` - Contains comprehensive test datasets
- **Key Files**: 
  - `recon_file_a.csv`, `recon_file_b.csv` - Reconciliation test data
  - `delta_fileA_old.csv`, `delta_fileB_new.csv` - Delta comparison data
  - `reconciliation_test_scenarios.md` - Detailed test scenarios and expected results

### Test Scenarios
The sample data covers:
- Exact reference matching
- Amount tolerance matching (0.01 precision)
- Date format conversions (YYYY-MM-DD ↔ DD/MM/YYYY)
- Status mapping between different systems
- Negative amounts and large numbers
- Unmatched records handling

## API Documentation

### Key Endpoints
- **Health**: `/health` - System status
- **Upload**: `/upload` - File upload endpoint
- **Reconciliation**: `/reconciliation/*` - Reconciliation operations
- **Transformation**: `/transformation/*` - Data transformation
- **Delta**: `/delta/*` - Delta generation
- **AI Assistance**: `/ai-assistance/*` - AI-powered features
- **Debug**: `/debug/status` - System debugging information

### Performance Monitoring
- `/performance/metrics` - Current system performance
- `/debug/status` - Detailed system status with optimization metrics

## Common Patterns

### Error Handling
- Custom exception handlers for large file processing
- Structured error responses with debug mode support
- Comprehensive logging with structured format

### Data Processing Flow
1. **Upload** → File validation and storage
2. **Extract** → Pattern-based data extraction
3. **Filter** → Rule-based data filtering
4. **Process** → Reconciliation/Transformation/Delta
5. **Export** → Result generation and download

### API Response Format
```json
{
  "success": boolean,
  "message": "descriptive message",
  "data": {} // or array
}
```

## Development Tips

### Backend Development
- Use the custom test runner for comprehensive testing
- Follow the existing service/route separation pattern
- Leverage the existing optimization patterns for large datasets
- Use structured logging for debugging
- Test with sample data in `backend/sample_data/`

### Frontend Development
- Follow the established component organization
- Use existing service patterns for API communication
- Leverage the custom hooks for state management
- Maintain consistency with existing UI patterns
- Test with the full stack running (backend + frontend)

### Performance Considerations
- Test with large datasets (sample data simulates 50k+ records)
- Use batch processing for operations
- Implement proper error handling for timeout scenarios
- Monitor memory usage during development