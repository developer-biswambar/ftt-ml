# Reconciliation Workflow Examples

## 🔄 Financial Data Reconciliation Workflow

This guide demonstrates how to reconcile financial transactions between two data sources using the FTT-ML API.

## 📋 Prerequisites

- FTT-ML API running on `http://localhost:8000`
- Two financial data files (CSV/Excel) to reconcile
- Understanding of your data structure and matching criteria

## 🚀 Step-by-Step Reconciliation Workflow

### Step 1: Upload Source Files

Upload both files that need to be reconciled:

```bash
# Upload primary file (e.g., bank statements)
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@bank_statements.csv"

# Upload comparison file (e.g., internal records)
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@internal_records.csv"
```

**Responses:**
```json
{
  "success": true,
  "data": {
    "file_id": "file_bank_123",
    "filename": "bank_statements.csv",
    "columns": ["transaction_id", "date", "amount", "description", "account"]
  }
}

{
  "success": true,
  "data": {
    "file_id": "file_internal_456",
    "filename": "internal_records.csv", 
    "columns": ["ref_number", "transaction_date", "value", "memo", "account_number"]
  }
}
```

### Step 2: Configure Reconciliation Rules

Define how transactions should be matched:

```bash
curl -X POST "http://localhost:8000/reconciliation/process/" \
  -H "Content-Type: application/json" \
  -d '{
    "file_a_id": "file_bank_123",
    "file_b_id": "file_internal_456",
    "reconciliation_config": {
      "name": "Bank vs Internal Reconciliation",
      "description": "Match bank statements with internal transaction records",
      "matching_criteria": [
        {
          "field_a": "transaction_id",
          "field_b": "ref_number",
          "match_type": "exact",
          "weight": 0.4
        },
        {
          "field_a": "amount",
          "field_b": "value",
          "match_type": "tolerance",
          "tolerance": 0.01,
          "weight": 0.4
        },
        {
          "field_a": "date",
          "field_b": "transaction_date",
          "match_type": "date",
          "date_format_a": "YYYY-MM-DD",
          "date_format_b": "DD/MM/YYYY",
          "tolerance_days": 1,
          "weight": 0.2
        }
      ],
      "match_threshold": 0.8,
      "auto_match": true,
      "preserve_unmatched": true
    }
  }'
```

### Step 3: Process Reconciliation

**Response:**
```json
{
  "success": true,
  "reconciliation_id": "recon_xyz789",
  "total_records_a": 1500,
  "total_records_b": 1480,
  "matched_pairs": 1420,
  "unmatched_a": 80,
  "unmatched_b": 60,
  "match_rate": 94.67,
  "processing_time_seconds": 3.456,
  "summary": {
    "perfect_matches": 1380,
    "partial_matches": 40,
    "potential_duplicates": 5
  }
}
```

### Step 4: Review Reconciliation Results

Get detailed reconciliation results:

```bash
curl -X GET "http://localhost:8000/reconciliation/results/recon_xyz789?category=matched&page=1&page_size=10"
```

**Response:**
```json
{
  "reconciliation_id": "recon_xyz789",
  "category": "matched",
  "total_records": 1420,
  "page": 1,
  "page_size": 10,
  "data": [
    {
      "match_id": "match_001",
      "confidence_score": 1.0,
      "match_type": "perfect",
      "record_a": {
        "transaction_id": "TXN001",
        "date": "2024-01-15",
        "amount": 1500.00,
        "description": "Payment received",
        "account": "ACC123"
      },
      "record_b": {
        "ref_number": "TXN001",
        "transaction_date": "15/01/2024",
        "value": 1500.00,
        "memo": "Payment received",
        "account_number": "ACC123"
      },
      "matching_fields": {
        "transaction_id": "exact_match",
        "amount": "exact_match",
        "date": "date_match_converted"
      }
    }
  ],
  "has_more": true
}
```

### Step 5: Review Unmatched Records

Check records that couldn't be matched:

```bash
# Unmatched from File A (Bank statements)
curl -X GET "http://localhost:8000/reconciliation/results/recon_xyz789?category=unmatched_a&page=1&page_size=10"

# Unmatched from File B (Internal records)  
curl -X GET "http://localhost:8000/reconciliation/results/recon_xyz789?category=unmatched_b&page=1&page_size=10"
```

### Step 6: Download Reconciliation Report

Download comprehensive reconciliation results:

```bash
# Download complete report as Excel
curl -X GET "http://localhost:8000/reconciliation/download/recon_xyz789?format=excel" \
  -o "reconciliation_report.xlsx"

# Download summary as CSV
curl -X GET "http://localhost:8000/reconciliation/download/recon_xyz789?format=csv&report_type=summary" \
  -o "reconciliation_summary.csv"
```

## 🔧 Advanced Reconciliation Configurations

### Multi-Field Matching

Match on multiple criteria with different weights:

```json
{
  "matching_criteria": [
    {
      "field_a": "account_number",
      "field_b": "account_id", 
      "match_type": "exact",
      "weight": 0.3
    },
    {
      "field_a": "amount",
      "field_b": "transaction_amount",
      "match_type": "tolerance",
      "tolerance": 0.01,
      "weight": 0.4
    },
    {
      "field_a": "reference",
      "field_b": "transaction_ref",
      "match_type": "fuzzy",
      "similarity_threshold": 0.8,
      "weight": 0.3
    }
  ],
  "match_threshold": 0.7
}
```

### Date Format Handling

Handle different date formats automatically:

```json
{
  "field_a": "transaction_date",
  "field_b": "date_processed",
  "match_type": "date",
  "date_format_a": "auto",
  "date_format_b": "auto",
  "tolerance_days": 2,
  "weight": 0.2
}
```

### Amount Tolerance Matching

Configure flexible amount matching:

```json
{
  "field_a": "gross_amount",
  "field_b": "net_amount", 
  "match_type": "tolerance",
  "tolerance": 0.05,
  "tolerance_type": "absolute",
  "weight": 0.5
}
```

### Percentage-based Tolerance

```json
{
  "field_a": "invoice_total",
  "field_b": "payment_amount",
  "match_type": "tolerance", 
  "tolerance": 2.0,
  "tolerance_type": "percentage",
  "weight": 0.6
}
```

## 📊 Understanding Match Types

### Exact Match
- Perfect string or numeric match
- Case-sensitive for strings
- Highest confidence score

### Tolerance Match  
- Numeric values within specified tolerance
- Absolute or percentage-based
- Good for amounts with minor differences

### Date Match
- Flexible date format handling
- Configurable tolerance in days
- Automatic format detection

### Fuzzy Match
- String similarity matching
- Uses algorithms like Levenshtein distance
- Good for descriptions with minor variations

## 🎯 Reconciliation Strategies

### Strategy 1: Conservative Matching
```json
{
  "match_threshold": 0.9,
  "auto_match": false,
  "require_manual_review": true
}
```

### Strategy 2: Aggressive Matching
```json
{
  "match_threshold": 0.6,
  "auto_match": true,
  "flag_low_confidence": true
}
```

### Strategy 3: Balanced Approach  
```json
{
  "match_threshold": 0.8,
  "auto_match": true,
  "manual_review_threshold": 0.7
}
```

## 📈 Performance Optimization

### Large Dataset Tips

For reconciling large datasets (50k+ records):

1. **Use Key Fields First**: Start with exact match fields
2. **Optimize Match Order**: Put high-weight criteria first
3. **Enable Indexing**: Use database-backed storage for huge datasets
4. **Batch Processing**: Process in chunks for memory efficiency

### Configuration Example for Large Datasets:

```json
{
  "performance_settings": {
    "enable_indexing": true,
    "batch_size": 5000,
    "parallel_processing": true,
    "memory_optimization": true
  },
  "matching_criteria": [
    {
      "field_a": "transaction_id",
      "field_b": "reference_id",
      "match_type": "exact",
      "weight": 0.5,
      "priority": 1
    }
  ]
}
```

## 🔍 Quality Assurance

### Validation Checklist

1. **Data Completeness**: Check for missing key fields
2. **Format Consistency**: Ensure date and number formats
3. **Duplicate Detection**: Identify duplicate records
4. **Match Quality**: Review confidence scores
5. **Business Rules**: Validate against business logic

### Sample Quality Report:

```json
{
  "quality_metrics": {
    "data_completeness": 98.5,
    "format_consistency": 95.2,
    "duplicate_rate": 0.3,
    "average_confidence": 0.87,
    "manual_review_required": 120
  }
}
```

## 🆘 Troubleshooting

### Common Issues

1. **Low Match Rate**: 
   - Check field mappings
   - Adjust tolerance settings
   - Review data quality

2. **Performance Issues**:
   - Reduce batch size
   - Optimize matching criteria
   - Enable indexing

3. **Memory Errors**:
   - Process in smaller chunks
   - Increase available memory
   - Use streaming processing

### Health Monitoring

```bash
curl -X GET "http://localhost:8000/reconciliation/health"
curl -X GET "http://localhost:8000/performance/metrics"
```