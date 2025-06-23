# File Comparison API - Technical Documentation

## 🚀 Overview

The `comparison_routes.py` module implements a sophisticated file comparison system that leverages OpenAI's GPT models
to analyze relationships between two datasets. It provides three distinct comparison modes and supports async processing
for scalability.

## 📋 Table of Contents

- [API Endpoints](#api-endpoints)
- [Core Processing Functions](#core-processing-functions)
- [Error Handling](#error-handling)
- [Performance Optimizations](#performance-optimizations)
- [Security Considerations](#security-considerations)
- [Usage Examples](#usage-examples)
- [Architecture Diagram](#architecture-diagram)

## 🔌 API Endpoints

### 1. Start Comparison

**`POST /api/v1/compare/`**

Initiates an asynchronous comparison between two uploaded files.

#### Request Model

```python
class ComparisonRequest(BaseModel):
   file_a_id: str  # UUID of first file
   file_b_id: str  # UUID of second file
   analysis_prompt: str  # Natural language instructions
   column_mappings: Optional[List[ColumnMapping]] = None  # For manual mode
   join_columns: Optional[Dict[str, str]] = None  # For joining data
   comparison_mode: str = "ai_guided"
   advanced_options: Optional[Dict[str, str]] = {
      "MIN_SAMPLE_SIZE": 50,
      "MAX_SAMPLE_SIZE": 200,
      "VALIDATE_ON_FULL_DATASET": true,
      "PATTERN_CONFIDENCE_THRESHOLD": 0.8
   }
   # ai_guided|manual_mapping|auto_detect
```

#### Technical Flow

1. **Validation Phase**
   - Verifies both file IDs exist in `uploaded_files` storage
   - Raises `HTTPException(404)` if files not found

2. **Initialization**
   ```python
   comparisons[comparison_id] = {
       "comparison_id": comparison_id,
       "file_a_id": request.file_a_id,
       "file_b_id": request.file_b_id,
       "status": "pending",
       "created_at": datetime.utcnow().isoformat()
   }
   ```

3. **Async Processing**
   - Uses `asyncio.create_task()` to spawn background processing
   - Non-blocking - returns immediately with comparison ID
   - Background task runs `process_comparison()` function

#### Response

```json
{
   "success": true,
   "message": "Comparison analysis started",
   "data": {
      "comparison_id": "uuid-here",
      "status": "processing",
      "estimated_time": "10-30 seconds"
   }
}
```

### 2. Get Comparison Status

**`GET /api/v1/compare/{comparison_id}`**

Retrieves current status and metadata of a comparison operation.

#### Returns

- Status: `pending` | `processing` | `completed` | `failed`
- Timestamps
- Error messages (if failed)
- Result data (if completed)

### 3. Get Comparison Results

**`GET /api/v1/compare/{comparison_id}/results`**

Returns formatted results of completed comparisons.

#### Response Structure

```json
{
   "comparison_info": {
      "comparison_id": "uuid",
      "file_a": "filename_a.csv",
      "file_b": "filename_b.csv",
      "analysis_prompt": "...",
      "mode": "ai_guided",
      "processing_time": 15.2
   },
   "results": {
      "summary": {
         ...
      },
      "findings": [
         ...
      ],
      "recommendations": [
         ...
      ]
   }
}
```

### 4. List All Comparisons

**`GET /api/v1/compare/`**

Returns paginated list of all comparisons, sorted by creation date (newest first).

### 5. Get Analysis Templates

**`GET /api/v1/compare/templates`**

Provides pre-configured analysis templates for common use cases.

## ⚙️ Core Processing Functions

### 1. Main Processing Pipeline

```python
async def process_comparison(comparison_id: str, request: ComparisonRequest)
```

#### Processing Steps

1. **Data Retrieval**
   ```python
   df_a = file_a_data["data"]  # Pandas DataFrame
   df_b = file_b_data["data"]  # Pandas DataFrame
   ```

2. **Context Preparation**
   ```python
   data_context = {
       "file_a_info": {
           "filename": str,
           "rows": int,
           "columns": List[str]
       },
       "file_b_info": {...},
       "file_a_sample": df_a.head(5).to_dict(orient='records'),
       "file_b_sample": df_b.head(5).to_dict(orient='records'),
       "column_stats": {
           "file_a_column": {
               "null_count": int,
               "unique_count": int,
               "dtype": str
           }
       }
   }
   ```

3. **Mode-Specific Processing**

   | Mode | Description | Process |
      |------|-------------|---------|
   | **AI-Guided** | Uses GPT-4 for intelligent analysis | Calls `analyze_with_openai()` with full context |
   | **Manual Mapping** | Compares specific column pairs | Iterates through mappings, calls `compare_column_values()` |
   | **Auto-Detect** | Automatically finds similar columns | Runs `detect_column_relationships()`, compares top matches |

### 2. AI Analysis Engine

```python
async def analyze_with_openai(prompt: str, data_context: Dict) -> Dict
```

#### OpenAI API Configuration

```python
response = await openai_client.chat.completions.create(
   model=OPENAI_MODEL,  # gpt-4-turbo
   messages=[system_message, user_message],
   temperature=0.1,  # Low temperature for consistency
   max_tokens=4000,  # Large context for detailed analysis
   response_format={"type": "json_object"}  # Enforces JSON output
)
```

#### Response Structure

```json
{
   "summary": {
      "total_matches": 150,
      "total_mismatches": 23,
      "match_rate": 86.7,
      "key_insights": [
         "insight1",
         "insight2"
      ]
   },
   "findings": [
      {
         "type": "match|mismatch|pattern|anomaly",
         "description": "detailed description",
         "severity": "high|medium|low",
         "examples": [
            {
               "file_a_row": "...",
               "file_b_row": "..."
            }
         ],
         "affected_rows": 15
      }
   ],
   "column_analysis": {
      "Trade_ID": {
         "data_type": "string",
         "unique_values": 200,
         "null_percentage": 0.5,
         "patterns_found": [
            "TRD prefix",
            "6-digit numbers"
         ]
      }
   },
   "recommendations": [
      "Standardize date formats",
      "Investigate missing trades"
   ]
}
```

### 3. Automatic Column Matching

```python
async def detect_column_relationships(df_a: pd.DataFrame, df_b: pd.DataFrame) -> List[Dict]
```

#### Detection Algorithm

1. **Name Matching**
   - Exact match: `confidence = 0.9`
   - Partial match (substring): `confidence = 0.7`
   - Case-insensitive comparison

2. **Data Type Compatibility**
   ```python
   if str(sample_a.dtype) == str(sample_b.dtype):
       # Same data type - potential match
   ```

3. **Value Overlap Analysis**
   ```python
   set_a = set(sample_a.astype(str))
   set_b = set(sample_b.astype(str))
   overlap = len(set_a.intersection(set_b))
   confidence = overlap / min(len(set_a), len(set_b))
   ```

4. **Confidence Scoring**
   - Returns sorted list by confidence score
   - Requires >10% overlap for consideration

### 4. Detailed Column Comparison

```python
async def compare_column_values(df_a: pd.DataFrame, df_b: pd.DataFrame,
                                col_a: str, col_b: str,
                                comparison_type: str = "exact") -> Dict
```

#### Comparison Types

| Type          | Description                 | Implementation                                  |
|---------------|-----------------------------|-------------------------------------------------|
| **Exact**     | Set-based comparison        | Uses set operations to find matches/differences |
| **Numerical** | Statistical comparison      | Calculates mean, std, min, max for both columns |
| **Fuzzy**     | String similarity (planned) | Would use Levenshtein distance                  |

## 🛡️ Error Handling

### File Validation

```python
if request.file_a_id not in uploaded_files:
   raise HTTPException(404, f"File A not found: {request.file_a_id}")
```

### Async Error Handling

```python
try:
# Processing logic
except Exception as e:
   logger.error(f"Comparison failed for {comparison_id}: {e}")
   comparisons[comparison_id].update({
      "status": "failed",
      "error": str(e),
      "completed_at": datetime.utcnow().isoformat()
   })
```

### OpenAI API Error Handling

- Catches API errors
- Logs detailed error messages
- Returns graceful error response

## ⚡ Performance Optimizations

### 1. Async Processing

- Non-blocking API responses
- Background task processing
- Concurrent operations where possible

### 2. Data Sampling

- Only sends 5 sample rows to OpenAI
- Calculates statistics locally
- Limits result sets to 100 items

### 3. Memory Management

- Uses generators where possible
- Limits string conversions
- Efficient set operations for comparisons

## 🔒 Security Considerations

### 1. Input Validation

- UUID validation for file IDs
- Prompt length restrictions
- Column name validation

### 2. Data Privacy

- Only sample data sent to OpenAI
- No PII detection implemented (could be added)
- Results stored in memory (not persisted)

## 📘 Usage Examples

### Trade Reconciliation

```python
{
   "file_a_id": "uuid-123",
   "file_b_id": "uuid-456",
   "analysis_prompt": "Compare trade records between our system and broker. Identify all breaks, missing trades, and amount discrepancies. Focus on settlement status differences.",
   "comparison_mode": "ai_guided"
}
```

### Data Migration Validation

```python
{
   "file_a_id": "uuid-123",
   "file_b_id": "uuid-456",
   "comparison_mode": "manual_mapping",
   "column_mappings": [
      {
         "file_a_column": "Trade_ID",
         "file_b_column": "TradeRef",
         "comparison_type": "exact"
      },
      {
         "file_a_column": "Amount",
         "file_b_column": "Value",
         "comparison_type": "numerical"
      }
   ]
}
```

### Data Quality Assessment

```python
{
   "file_a_id": "uuid-123",
   "file_b_id": "uuid-456",
   "analysis_prompt": "Assess data quality between files. Which has better data completeness?",
   "comparison_mode": "auto_detect"
}
```

## 🏗️ Architecture Diagram

```
┌─────────────────┐
│   API Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validation     │
│  - File exists  │
│  - Valid params │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Record   │
│ Return ID       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      Async Background Process       │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ AI-Guided   │  │Manual Mapping│ │
│  │             │  │              │ │
│  │ ┌─────────┐ │  │ ┌──────────┐ │ │
│  │ │OpenAI   │ │  │ │Column    │ │ │
│  │ │Analysis │ │  │ │Compare   │ │ │
│  │ └─────────┘ │  │ └──────────┘ │ │
│  └─────────────┘  └──────────────┘ │
│                                     │
│         ┌──────────────┐            │
│         │ Auto-Detect  │            │
│         │              │            │
│         │ ┌──────────┐ │            │
│         │ │Relation  │ │            │
│         │ │Detection │ │            │
│         │ └──────────┘ │            │
│         └──────────────┘            │
│                                     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Store Results  │
│  Update Status  │
└─────────────────┘
```

## 🔧 Extensibility Points

### 1. New Comparison Types

- Add to `comparison_type` in `ColumnMapping`
- Implement in `compare_column_values()`

### 2. Custom Analysis Functions

- Add new analysis functions
- Register in comparison modes

### 3. Export Formats

- Currently returns JSON
- Could add CSV, Excel, PDF generation

## 📊 Performance Metrics

| Operation         | Average Time | Notes                        |
|-------------------|--------------|------------------------------|
| File Upload       | < 1s         | For files up to 1MB          |
| AI Analysis       | 10-30s       | Depends on prompt complexity |
| Column Detection  | < 2s         | For typical datasets         |
| Manual Comparison | < 5s         | Per column pair              |

## 🚦 Status Codes

| Status       | Description                     |
|--------------|---------------------------------|
| `pending`    | Comparison created, not started |
| `processing` | Analysis in progress            |
| `completed`  | Results available               |
| `failed`     | Error occurred                  |

## 📝 License

This module is part of the Financial Data Extraction & Analysis API.

---

**Note**: This architecture provides a flexible, scalable solution for intelligent file comparison with both AI-powered
and deterministic analysis capabilities.