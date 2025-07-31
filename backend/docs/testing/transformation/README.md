# Data Transformation Testing Guide

This folder contains comprehensive testing resources for the Financial Data Transformation feature.

## 📁 Folder Contents

### Documentation Files
- **README.md** - This guide
- **AI_Transformation_Testing_Guide.md** - AI-powered transformation testing scenarios
- **transformation_workflows.md** - Step-by-step transformation workflows

### Test Data Files
- **customer_sales_test.csv** - Customer sales data for AI-powered transformation testing
- **sample_trades.csv** - Sample trading data for transformation testing
- **trade.csv** - Basic trade data for simple transformations
- **complex_financial_data.csv** - Complex dataset for advanced transformations (to be created)
- **multi_currency_data.csv** - Multi-currency transformation scenarios (to be created)

## 🚀 Quick Start Testing

### 1. Basic Transformation Test
```bash
# Start the backend server
cd /path/to/backend
python app/main.py

# Upload sample_trades.csv via API or frontend
# Configure basic column mapping transformation
```

### 2. Test Scenarios Covered

#### Column Mapping
- Direct column-to-column mapping
- Column name normalization
- Data type conversions
- Currency standardization

#### Row Generation
- Record duplication for audit trails
- Multi-line item expansion
- Tax calculation line items
- Regional localization records

#### Data Enrichment
- Calculated fields (totals, percentages)
- Lookup values and mappings
- Validation and cleansing
- Format standardization

### 3. Transformation Types

#### Simple Transformations
- **Direct Mapping**: Source column → Target column
- **Static Values**: Fixed values for all records
- **Column Renaming**: Update column headers

#### Complex Transformations  
- **Mathematical Expressions**: Formulas and calculations
- **Conditional Logic**: If-then-else transformations
- **Data Aggregation**: Grouping and summarization
- **Multi-file Joins**: Combining data from multiple sources

## 🧪 Testing Workflows

### Manual Testing Steps

1. **Upload Source Data**
   - Navigate to transformation interface
   - Upload sample_trades.csv
   - Review data preview and column detection

2. **Define Output Schema**
   - Specify target column names
   - Set data types and formats
   - Configure validation rules

3. **Configure Transformations**
   - Map source columns to targets
   - Add calculated fields
   - Set up row generation rules

4. **AI-Assisted Configuration**
   - Use natural language requirements
   - Generate transformation rules automatically
   - Review and adjust AI suggestions

5. **Execute and Validate**
   - Run transformation process
   - Review output data
   - Export transformed results

### API Testing

```bash
# Upload source file
curl -X POST "http://localhost:8000/upload" \
  -F "file=@docs/testing/transformation/sample_trades.csv" \
  -F "label=Trades Data"

# Define transformation schema
curl -X POST "http://localhost:8000/transformation/schema" \
  -H "Content-Type: application/json" \
  -d '{
    "output_columns": [
      {"name": "trade_id", "type": "string"},
      {"name": "total_amount", "type": "number"},
      {"name": "trade_date", "type": "date"}
    ]
  }'

# Execute transformation
curl -X POST "http://localhost:8000/transformation/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "uploaded_file_id",
    "transformations": [
      {
        "target_column": "total_amount",
        "type": "expression",
        "formula": "{quantity} * {price}"
      }
    ]
  }'
```

## 📊 Sample Data Descriptions

### customer_sales_test.csv
- **Records**: 15 customer sales transactions
- **Columns**: customer_id, first_name, last_name, email, phone, purchase_date, product_category, product_name, quantity, unit_price, discount_percent, payment_method, order_status, shipping_address, region
- **Use Case**: AI-powered transformation testing with customer data
- **Complexity**: Medium - ideal for testing AI rule generation

### sample_trades.csv
- **Records**: 1,000 trading transactions
- **Columns**: trade_id, symbol, quantity, price, currency, trade_date, trader_id
- **Use Case**: Basic trading data transformation
- **Complexity**: Medium

### trade.csv  
- **Records**: 100 simple trades
- **Columns**: id, symbol, qty, price, date
- **Use Case**: Basic column mapping and renaming
- **Complexity**: Low

### complex_financial_data.csv
- **Records**: 5,000 multi-instrument trades
- **Columns**: 25+ columns including nested data
- **Use Case**: Advanced transformation scenarios
- **Complexity**: High

## 🎯 Common Transformation Scenarios

### 1. Trading Data Normalization
```json
{
  "scenario": "Normalize trading data format",
  "input": "sample_trades.csv",
  "transformations": [
    {"source": "trade_id", "target": "transaction_id", "type": "direct"},
    {"source": "quantity", "target": "volume", "type": "direct"},
    {"target": "total_value", "type": "expression", "formula": "{quantity} * {price}"},
    {"target": "trade_type", "type": "static", "value": "EQUITY"}
  ],
  "expected_records": 1000
}
```

### 2. Multi-Currency Conversion
```json
{
  "scenario": "Convert all amounts to USD",
  "input": "multi_currency_data.csv",
  "transformations": [
    {"target": "amount_usd", "type": "expression", "formula": "{amount} * {fx_rate}"},
    {"target": "currency", "type": "static", "value": "USD"}
  ],
  "validation": "All amounts in USD"
}
```

### 3. Row Expansion for Tax Calculation
```json
{
  "scenario": "Create separate line items for tax calculations",
  "input": "sample_trades.csv",
  "row_generation": {
    "type": "expand",
    "strategy": "tax_line_items",
    "expansions": [
      {"line_type": "principal", "amount_field": "principal_amount"},
      {"line_type": "tax", "amount_field": "tax_amount"}
    ]
  },
  "expected_records": 2000
}
```

## 📈 Performance Benchmarks

### Expected Performance
- **Small Dataset** (< 1K records): < 3 seconds
- **Medium Dataset** (1K-10K records): < 15 seconds
- **Large Dataset** (10K-100K records): < 2 minutes
- **Complex Transformations**: +50% processing time

### Memory Usage
- **Baseline**: ~75MB
- **10K records**: ~150MB
- **50K records**: ~400MB
- **Complex rules**: +30% memory usage

## 🔍 Testing Checklist

### Core Functionality
- [ ] File upload and parsing
- [ ] Column mapping configuration
- [ ] Data type conversions
- [ ] Expression evaluation
- [ ] Static value assignment
- [ ] Row generation rules
- [ ] Output validation
- [ ] Export functionality

### AI Features
- [ ] Natural language rule interpretation
- [ ] Automatic mapping suggestions
- [ ] Complex transformation generation
- [ ] Business logic recognition

### Performance
- [ ] Large file processing (100K+ records)
- [ ] Memory usage optimization
- [ ] Processing time benchmarks
- [ ] Error handling for invalid data

### Data Quality
- [ ] Accuracy of transformations
- [ ] Data type preservation
- [ ] Null value handling
- [ ] Format consistency

## 🚦 Success Criteria

### Functional Requirements
- ✅ 100% accuracy for direct mappings
- ✅ Correct expression evaluation
- ✅ Proper row generation logic
- ✅ Data validation and cleansing
- ✅ AI-powered rule generation

### Performance Requirements
- ✅ Process 100K records within 2 minutes
- ✅ Memory usage under 400MB for standard transformations
- ✅ Support for 50+ transformation rules per job
- ✅ Real-time preview for up to 1K records

## 🔧 Advanced Testing

### Custom Transformation Functions
```javascript
// Example custom transformation function
function calculateCommission(trade_value, commission_rate) {
    return Math.round(trade_value * commission_rate * 100) / 100;
}
```

### Batch Processing Test
```bash
# Process multiple files in sequence
python scripts/batch_transform.py \
  --input docs/testing/transformation/ \
  --config transformation_rules.json \
  --output transformed_data/
```

### Integration Testing
- Frontend transformation interface
- API endpoint validation  
- Database persistence
- Export format verification

## 📞 Troubleshooting

### Common Issues
1. **Memory errors with large files**: Reduce batch size or implement streaming
2. **Expression evaluation failures**: Check syntax and variable names
3. **Row generation duplicates**: Verify expansion logic configuration
4. **Performance degradation**: Optimize transformation rules and indexing

### Debug Commands
```bash
# Enable detailed logging
export TRANSFORMATION_DEBUG=true
export LOG_LEVEL=DEBUG
python app/main.py
```

---

**Last Updated**: December 2024  
**Version**: 2.0.0  
**Maintainer**: FTT-ML Development Team