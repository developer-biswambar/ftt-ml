# Reconciliation Testing Guide

This folder contains comprehensive testing resources for the Financial Data Reconciliation feature.

## 📁 Folder Contents

### Documentation Files
- **README.md** - This guide
- **Reconciliation_Testing_Suite.md** - Comprehensive testing framework and scenarios  
- **reconciliation_test_scenarios.md** - Detailed test scenarios with expected results

### Test Data Files
- **recon_file_a.csv** - Primary reconciliation source file
- **recon_file_b.csv** - Secondary reconciliation source file  
- **credit_card_transactions.csv** - Credit card transaction data for testing
- **expense_receipts.csv** - Expense receipt data for testing
- **invoice_register.csv** - Invoice register data for testing
- **payment_records.csv** - Payment records data for testing

## 🚀 Quick Start Testing

### 1. Basic Reconciliation Test
```bash
# Start the backend server
cd /path/to/backend
python app/main.py

# Upload test files via API or frontend
# Use recon_file_a.csv and recon_file_b.csv
```

### 2. Test Scenarios Covered

#### Exact Matching
- Reference number matching
- Transaction ID matching
- ISIN code matching

#### Tolerance Matching  
- Amount matching with 0.01 precision
- Date format conversions (YYYY-MM-DD ↔ DD/MM/YYYY)
- Currency amount variations

#### Advanced Scenarios
- Multiple matching rules
- Unmatched record handling
- Large dataset performance (50k+ records)
- Error handling and validation

### 3. Expected Results

#### File A (recon_file_a.csv)
- **Total Records**: 15
- **Matched Records**: 12
- **Unmatched Records**: 3
- **Match Types**: Exact (8), Tolerance (4)

#### File B (recon_file_b.csv)  
- **Total Records**: 18
- **Matched Records**: 12
- **Unmatched Records**: 6
- **New Records**: 6

## 🧪 Testing Workflows

### Manual Testing Steps

1. **Upload Files**
   - Navigate to reconciliation interface
   - Upload recon_file_a.csv as File A
   - Upload recon_file_b.csv as File B

2. **Configure Matching Rules**
   - Set reference number matching
   - Enable amount tolerance (0.01)
   - Configure date format conversion

3. **Execute Reconciliation**
   - Review matching results
   - Validate unmatched records
   - Export reconciliation report

4. **AI-Powered Configuration**
   - Use AI Requirements Step
   - Test natural language rule generation
   - Validate generated matching logic

### API Testing

```bash
# Upload files
curl -X POST "http://localhost:8000/upload" \
  -F "file=@docs/testing/reconciliation/recon_file_a.csv" \
  -F "label=File A"

# Start reconciliation
curl -X POST "http://localhost:8000/reconciliation/start" \
  -H "Content-Type: application/json" \
  -d '{
    "file_a_id": "file_a_id",
    "file_b_id": "file_b_id",
    "matching_rules": {
      "reference_matching": true,
      "amount_tolerance": 0.01
    }
  }'
```

## 📊 Performance Benchmarks

### Expected Performance
- **Small Dataset** (< 1K records): < 2 seconds
- **Medium Dataset** (1K-10K records): < 10 seconds  
- **Large Dataset** (10K-50K records): < 60 seconds
- **Enterprise Dataset** (50K+ records): < 5 minutes

### Memory Usage
- **Baseline**: ~50MB
- **10K records**: ~100MB
- **50K records**: ~250MB
- **100K records**: ~500MB

## 🔍 Troubleshooting

### Common Issues

1. **File Upload Errors**
   - Ensure CSV files are properly formatted
   - Check file size limits (default: 100MB)
   - Verify column headers match expected format

2. **Matching Rule Failures**
   - Verify column names exist in both files
   - Check data type compatibility
   - Review tolerance settings

3. **Performance Issues**
   - Monitor memory usage for large files
   - Check server resources
   - Review batch processing settings

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
python app/main.py
```

## 📋 Test Checklist

- [ ] File upload functionality
- [ ] Column mapping validation
- [ ] Exact matching rules
- [ ] Tolerance matching rules
- [ ] Date format conversion
- [ ] Currency handling
- [ ] Unmatched record identification
- [ ] Report generation
- [ ] AI configuration generation
- [ ] Performance with large datasets
- [ ] Error handling and validation
- [ ] Memory usage optimization

## 🚦 Success Criteria

### Functional Requirements
- ✅ Accurate matching based on configured rules
- ✅ Proper handling of unmatched records
- ✅ Tolerance matching within specified limits
- ✅ Date format normalization
- ✅ AI-powered rule generation

### Non-Functional Requirements  
- ✅ Process 50K records within 5 minutes
- ✅ Memory usage under 500MB for 100K records
- ✅ 99.9% accuracy for exact matches
- ✅ Error rate < 0.1% for tolerance matches

## 📈 Advanced Testing

### Load Testing
```bash
# Generate large test datasets
python scripts/generate_test_data.py --records 50000

# Run performance tests
python scripts/performance_test.py --dataset large
```

### Integration Testing
- Test with frontend React components
- Validate API endpoints
- Check database persistence
- Verify export functionality

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs in debug mode
3. Consult API documentation
4. Contact development team

---

**Last Updated**: December 2024  
**Version**: 2.0.0  
**Maintainer**: FTT-ML Development Team