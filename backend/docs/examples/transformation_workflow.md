# Transformation Workflow Examples

## 🔄 Complete Transformation Workflow

This guide demonstrates a complete transformation workflow from file upload to result download.

## 📋 Prerequisites

- FTT-ML API running on `http://localhost:8000`
- OpenAI API key configured
- Sample CSV file with customer data

## 🚀 Step-by-Step Workflow

### Step 1: Upload Source File

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@customer_data.csv"
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file_id": "file_abc123",
    "filename": "customer_data.csv",
    "file_size_mb": 1.2,
    "total_rows": 1000,
    "columns": ["customer_id", "first_name", "last_name", "email", "amount", "tax_rate"],
    "file_type": "csv"
  }
}
```

### Step 2: Generate AI Configuration (Optional)

Use AI to automatically generate transformation rules:

```bash
curl -X POST "http://localhost:8000/transformation/generate-config/" \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Create a customer summary with full name, email, and total amount including tax",
    "source_files": [
      {
        "file_id": "file_abc123",
        "filename": "customer_data.csv",
        "columns": ["customer_id", "first_name", "last_name", "email", "amount", "tax_rate"],
        "totalRows": 1000
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration generated successfully",
  "data": {
    "name": "Customer Summary Transformation",
    "description": "Transform customer data to include full name and calculate total with tax",
    "source_files": [
      {
        "file_id": "file_abc123",
        "alias": "file_abc123",
        "purpose": "Primary data source"
      }
    ],
    "row_generation_rules": [
      {
        "id": "rule_1",
        "name": "Customer Summary",
        "enabled": true,
        "output_columns": [
          {
            "id": "col_1",
            "name": "customer_id",
            "mapping_type": "direct",
            "source_column": "customer_id"
          },
          {
            "id": "col_2",
            "name": "full_name",
            "mapping_type": "static",
            "static_value": "{first_name} {last_name}"
          },
          {
            "id": "col_3",
            "name": "email",
            "mapping_type": "direct",
            "source_column": "email"
          },
          {
            "id": "col_4",
            "name": "total_with_tax",
            "mapping_type": "static",
            "static_value": "{amount} * (1 + {tax_rate}/100)"
          }
        ],
        "priority": 0
      }
    ],
    "merge_datasets": false,
    "validation_rules": []
  }
}
```

### Step 3: Process Transformation

Execute the transformation using the configuration:

```bash
curl -X POST "http://localhost:8000/transformation/process/" \
  -H "Content-Type: application/json" \
  -d '{
    "source_files": [
      {
        "file_id": "file_abc123",
        "alias": "file_abc123",
        "purpose": "Primary data source"
      }
    ],
    "transformation_config": {
      "name": "Customer Summary Transformation",
      "description": "Transform customer data to include full name and calculate total with tax",
      "source_files": [
        {
          "file_id": "file_abc123",
          "alias": "file_abc123",
          "purpose": "Primary data source"
        }
      ],
      "row_generation_rules": [
        {
          "id": "rule_1",
          "name": "Customer Summary",
          "enabled": true,
          "output_columns": [
            {
              "id": "col_1",
              "name": "customer_id",
              "mapping_type": "direct",
              "source_column": "customer_id"
            },
            {
              "id": "col_2",
              "name": "full_name",
              "mapping_type": "static",
              "static_value": "{first_name} {last_name}"
            },
            {
              "id": "col_3",
              "name": "email",
              "mapping_type": "direct",
              "source_column": "email"
            },
            {
              "id": "col_4",
              "name": "total_with_tax",
              "mapping_type": "static",
              "static_value": "{amount} * (1 + {tax_rate}/100)"
            }
          ],
          "priority": 0
        }
      ],
      "merge_datasets": false,
      "validation_rules": []
    },
    "preview_only": false
  }'
```

**Response:**
```json
{
  "success": true,
  "transformation_id": "transform_xyz789",
  "total_input_rows": 1000,
  "total_output_rows": 1000,
  "processing_time_seconds": 2.456,
  "validation_summary": {
    "input_row_count": 1000,
    "output_row_count": 1000,
    "processing_time": 2.456,
    "rules_processed": 1,
    "datasets_generated": 1
  },
  "warnings": [],
  "errors": []
}
```

### Step 4: Preview Results (Optional)

Preview the transformation results:

```bash
curl -X GET "http://localhost:8000/transformation/results/transform_xyz789?page=1&page_size=10"
```

**Response:**
```json
{
  "transformation_id": "transform_xyz789",
  "timestamp": "2024-01-15T10:30:00",
  "total_rows": 1000,
  "page": 1,
  "page_size": 10,
  "data": [
    {
      "customer_id": "CUST001",
      "full_name": "John Doe",
      "email": "john.doe@email.com",
      "total_with_tax": 110.00
    },
    {
      "customer_id": "CUST002",
      "full_name": "Jane Smith",
      "email": "jane.smith@email.com",
      "total_with_tax": 220.50
    }
  ],
  "has_more": true,
  "available_datasets": ["Customer Summary"]
}
```

### Step 5: Download Results

Download the transformed data in your preferred format:

```bash
# Download as CSV
curl -X GET "http://localhost:8000/transformation/download/transform_xyz789?format=csv" \
  -o "customer_summary.csv"

# Download as Excel
curl -X GET "http://localhost:8000/transformation/download/transform_xyz789?format=excel" \
  -o "customer_summary.xlsx"

# Download as JSON
curl -X GET "http://localhost:8000/transformation/download/transform_xyz789?format=json" \
  -o "customer_summary.json"
```

## 🔄 Advanced Transformation Examples

### Dynamic Conditions Example

Transform data with conditional logic:

```json
{
  "name": "customer_tier",
  "mapping_type": "dynamic",
  "dynamic_conditions": [
    {
      "condition_column": "amount",
      "operator": ">=",
      "condition_value": "1000",
      "output_value": "Premium"
    },
    {
      "condition_column": "amount",
      "operator": ">=",
      "condition_value": "500",
      "output_value": "Gold"
    }
  ],
  "default_value": "Standard"
}
```

### Mathematical Expressions

Calculate complex values:

```json
{
  "name": "discounted_total",
  "mapping_type": "static",
  "static_value": "{amount} * (1 - {discount_percent}/100) * (1 + {tax_rate}/100)"
}
```

### String Manipulation

Combine and format strings:

```json
{
  "name": "formatted_address",
  "mapping_type": "static",
  "static_value": "{street_address}, {city}, {state} {zip_code}"
}
```

## 🧪 Testing Your Transformation

### Preview Mode

Test your configuration before processing all data:

```json
{
  "preview_only": true,
  "row_limit": 10
}
```

### Validation

Check for common issues:

1. **Column Names**: Ensure source columns exist in your data
2. **Data Types**: Verify numeric columns for mathematical operations
3. **Expression Syntax**: Test expressions with sample data
4. **Conditional Logic**: Verify conditions match expected data patterns

## 🚀 Performance Tips

### Large Dataset Processing

For files with 50k+ rows:

1. **Use Batch Processing**: Configure appropriate batch sizes
2. **Enable Streaming**: Use streaming downloads for large results
3. **Monitor Memory**: Check system resources during processing
4. **Paginate Results**: Retrieve results in chunks

### Optimization Settings

```bash
# Environment variables for performance
BATCH_SIZE=1000
CHUNK_SIZE=10000
MEMORY_LIMIT_GB=4
```

## 🆘 Troubleshooting

### Common Issues

1. **File Not Found**: Verify file_id from upload response
2. **Column Not Found**: Check column names match source data exactly
3. **Expression Errors**: Validate mathematical expressions with test data
4. **Timeout Errors**: Reduce batch size for large datasets

### Health Checks

Monitor transformation service health:

```bash
curl -X GET "http://localhost:8000/transformation/health"
```

### Debug Information

Get detailed system status:

```bash
curl -X GET "http://localhost:8000/debug/status"
```