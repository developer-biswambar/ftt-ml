# Reconciliation Testing Guide

## Overview
This guide provides comprehensive testing for the reconciliation functionality in your financial platform. The tests cover file upload, configuration, processing, and results validation.

## Test Files Created

### 1. Comprehensive Test Data
- **File A**: `comprehensive-file-a.csv` - 12 transaction records
- **File B**: `comprehensive-file-b.csv` - 11 statement records
- **Expected Results**: 
  - ✅ 8 Exact matches
  - ⚠️ 3 Tolerance matches (amounts differ by ≤0.01)
  - ❌ 2 Unmatched (1 in each file)

### 2. Exact Match Test Data  
- **File A**: `exact-match-file-a.csv` - 5 records
- **File B**: `exact-match-file-b.csv` - 5 records
- **Expected Results**: 100% match rate (5/5)

### 3. Tolerance Match Test Data
- **File A**: `tolerance-match-file-a.csv` - 5 records  
- **File B**: `tolerance-match-file-b.csv` - 5 records
- **Expected Results**: 100% tolerance match (differences ≤0.01)

## Test Scenarios Covered

### 🎯 Complete Workflow Test
Tests the entire reconciliation process from start to finish:

1. **Navigation** - Find and access reconciliation section
2. **File Upload** - Upload test CSV files
3. **Configuration** - Set up field mappings and rules
4. **Processing** - Execute reconciliation
5. **Results** - Validate matched/unmatched records
6. **Export** - Download results

### 🧪 Match Scenario Tests
Tests different types of matching:

- **Exact Matches**: Perfect field alignment
- **Tolerance Matches**: Small amount differences (±0.01)
- **Unmatched Records**: Records that don't match

### 📊 Validation Tests
- Match count validation
- Unmatched record identification
- Export functionality
- Error handling

## Running the Tests

### Quick Test
```bash
npm run test:reconciliation
```

### Debug Mode (Step-by-step)
```bash
npm run test:reconciliation:debug
```

### Full HTML Report
```bash
npm run test:reconciliation:full
```

## Expected Test Results

### Comprehensive Test File Matches
| Reference | File A Amount | File B Amount | Match Type | Status |
|-----------|---------------|---------------|------------|---------|
| REF12345  | 1000.50      | 1000.50      | Exact      | ✅ Match |
| REF12346  | 2500.75      | 2500.75      | Exact      | ✅ Match |
| REF12347  | 750.25       | 750.25       | Exact      | ✅ Match |
| REF12348  | 1200.00      | 1200.01      | Tolerance  | ⚠️ Match |
| REF12349  | 850.33       | 850.33       | Exact      | ✅ Match |
| REF12350  | 1500.00      | 1499.99      | Tolerance  | ⚠️ Match |
| REF12351  | 99.99        | 99.98        | Tolerance  | ⚠️ Match |
| REF12352  | 3000.25      | 3000.25      | Exact      | ✅ Match |
| REF12354  | 2200.50      | 2200.50      | Exact      | ✅ Match |
| REF12355  | 1750.00      | 1750.01      | Tolerance  | ⚠️ Match |
| REF99999  | 999.99       | -            | No Match   | ❌ Unmatched A |
| REF88888  | -            | 888.88       | No Match   | ❌ Unmatched B |

### Summary Statistics
- **Total Records A**: 12
- **Total Records B**: 11  
- **Exact Matches**: 6
- **Tolerance Matches**: 4
- **Unmatched A**: 1
- **Unmatched B**: 1
- **Match Rate**: 83.3%

## Test Features

### 🔍 Smart Element Detection
- Automatically finds reconciliation navigation
- Detects file upload mechanisms
- Identifies process buttons
- Locates results displays

### 📸 Visual Documentation
- Screenshots at each step
- Before/after processing states
- Results visualization
- Error state capture

### 🚨 Error Handling
- Handles missing UI elements
- Continues testing when components aren't found
- Provides detailed error logging
- Suggests alternative approaches

### 📊 Comprehensive Reporting
- JSON test reports
- HTML visualization
- Console logging
- Performance metrics

## Troubleshooting

### Common Issues

#### File Upload Not Working
- Check if file inputs are visible
- Try upload button approach
- Verify file paths are correct
- Ensure CSV format is valid

#### Process Button Disabled
- Verify both files are uploaded
- Check configuration requirements
- Look for validation errors
- Try different button selectors

#### No Results Displayed
- Wait longer for processing
- Check for error messages
- Verify data format compatibility
- Review console logs

#### Export Not Working
- Check download permissions
- Verify export button is enabled
- Look for alternative download methods
- Check browser download settings

## Configuration Requirements

### File Format Requirements
- CSV format with headers
- UTF-8 encoding
- Consistent column naming
- No empty rows

### Field Mapping
The tests expect these field mappings:
- **Reference**: Reference_Number ↔ Reference
- **Amount**: Amount ↔ Value  
- **Date**: Transaction_Date ↔ Date_Processed
- **Status**: Status ↔ Bank_Status

### Tolerance Settings
- **Amount Tolerance**: ±0.01
- **Date Format**: Flexible (YYYY-MM-DD or DD/MM/YYYY)
- **Status Mapping**: Case-insensitive

## Screenshots Generated

Each test run creates timestamped screenshots:
- `recon-00-initial-state.png` - App startup
- `recon-01-navigation.png` - Reconciliation section
- `recon-02-files-uploaded.png` - After file upload
- `recon-03-configuration.png` - Configuration setup
- `recon-04-processing.png` - During processing
- `recon-05-results.png` - Results display
- `recon-06-export.png` - Export functionality

## Performance Benchmarks

### Expected Processing Times
- **File Upload**: < 2 seconds
- **Configuration**: < 1 second  
- **Processing**: < 5 seconds (12 records)
- **Results Display**: < 2 seconds
- **Export**: < 3 seconds

### Resource Usage
- **Memory**: < 50MB for test files
- **CPU**: Minimal during upload/config
- **Network**: API calls to localhost:8000

## Advanced Testing

### Custom Test Data
Create your own test files in `testing/fixtures/reconciliation/`:
- Follow the CSV format
- Include expected match scenarios
- Document expected results
- Update test expectations

### Configuration Testing
Test different reconciliation rules:
- Exact matching only
- Different tolerance levels
- Custom field mappings
- Multiple matching criteria

### Performance Testing  
Test with larger datasets:
- 100+ records
- 1000+ records
- Complex matching rules
- Multiple file pairs

## Integration with CI/CD

### Pre-commit Testing
```bash
# Add to .github/workflows/test.yml
- name: Test Reconciliation
  run: npm run test:reconciliation
```

### Automated Reporting
- HTML reports for CI
- Screenshot archiving
- Performance regression detection
- Match accuracy validation

## Next Steps

1. **Run the basic test**: `npm run test:reconciliation`
2. **Review screenshots** to see UI behavior
3. **Check test results** for match accuracy
4. **Customize test data** for your specific needs
5. **Integrate with CI/CD** for automated testing