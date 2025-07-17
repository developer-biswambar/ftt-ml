# Reconciliation Test Scenarios & Expected Results

## Test Files Overview

### File A: Financial Transactions (Primary File)
- **Format**: Transaction_ID, Date (YYYY-MM-DD), Description, Amount_Text (with $), Status, Account, Reference, Customer_ID, Branch
- **Records**: 20 transactions
- **Key Characteristics**: 
  - Amounts in text format with $ and commas
  - Date format: YYYY-MM-DD
  - Status values: Settled, Pending, Completed, Failed

### File B: Bank Statements (Comparison File)
- **Format**: Statement_ID, Process_Date (DD/MM/YYYY), Transaction_Desc, Net_Amount (numeric), Settlement_Status, Account_Number, Ref_Number, Client_Code, Location
- **Records**: 22 statements (includes 2 unmatched)
- **Key Characteristics**:
  - Amounts in numeric format
  - Date format: DD/MM/YYYY
  - Status values: SETTLED, PROCESSING, COMPLETE, REJECTED

---

## Extraction Rules Test Scenarios

### 1. Amount Extraction from File A
**Pattern**: `\$([0-9,]+(?:\.[0-9]{2})?)`  
**Source Column**: Amount_Text  
**Result Column**: Extracted_Amount  
**Expected Results**: 
- "$1,234.56" → "1,234.56"
- "$-456.78" → Will need different pattern for negatives

### 2. Date Standardization
**File A**: Already in YYYY-MM-DD format (no extraction needed)  
**File B**: Convert DD/MM/YYYY to YYYY-MM-DD format  
**Pattern**: `(\d{2})/(\d{2})/(\d{4})` → Replace with `$3-$2-$1`

---

## Filter Rules Test Scenarios

### 1. Status Filtering
**File A Filter**: Status = "Settled" or "Completed"  
**File B Filter**: Settlement_Status = "SETTLED" or "COMPLETE"  
**Expected**: Reduces dataset to successful transactions only

### 2. Date Range Filtering
**Both Files**: Transactions between 2024-01-20 and 2024-01-30  
**Expected**: Filters to 11 records from File A, 12 from File B

### 3. Amount Range Filtering
**Both Files**: Amounts > 100  
**Expected**: Excludes small transactions like $29.99, $78.45, $89.99

---

## Reconciliation Rules Test Scenarios

### 1. Exact Reference Match
**Rule**: File A.Reference = File B.Ref_Number  
**Match Type**: Exact  
**Expected Matches**: 20 perfect matches (REF123 through REF142)

### 2. Amount Tolerance Match
**Rule**: File A.Extracted_Amount ≈ File B.Net_Amount (tolerance: 0.01)  
**Expected Results**:
- **Perfect Matches**: 19 records
- **Tolerance Match**: STMT002 (2500.01) vs TXN002 (2500.00) - difference of 0.01
- **Tolerance Mismatch**: STMT016 (2345.68) vs TXN016 (2345.67) - difference of 0.01 (within tolerance)

### 3. Date Match with Format Conversion
**Rule**: File A.Date = File B.Process_Date (after conversion)  
**Expected**: All dates should match after format standardization

### 4. Account Number Exact Match
**Rule**: File A.Account = File B.Account_Number  
**Expected**: Perfect matches for all 20 records

### 5. Customer ID Match
**Rule**: File A.Customer_ID = File B.Client_Code  
**Expected**: Perfect matches for all records

---

## Expected Reconciliation Results

### Complete Match Summary

| Scenario                 | File A Records | File B Records | Perfect Matches | Tolerance Matches | Unmatched A | Unmatched B |
|--------------------------|----------------|----------------|------------------|--------------------|-------------|-------------|
| **Full Reconciliation**  | 20             | 22             | 20               | 0                  | 0           | 2           |
| **Status Filtered**      | 16             | 18             | 16               | 0                  | 0           | 2           |
| **Date Range Filtered**  | 11             | 12             | 11               | 0                  | 0           | 1           |
| **Amount > 100 Filtered**| 17             | 19             | 17               | 0                  | 0           | 2           |

### Detailed Match Results

#### Perfect Matches (20 records)
1. **TXN001 ↔ STMT001**: REF123, Amount: 1234.56, Date: 2024-01-15, Account: ACC001  
2. **TXN002 ↔ STMT002**: REF124, Amount: 2500.00/2500.01 (tolerance), Date: 2024-01-16  
3. **TXN003 ↔ STMT003**: REF125, Amount: -456.78, Date: 2024-01-17  
4. **TXN004 ↔ STMT004**: REF126, Amount: 10000.00, Date: 2024-01-18  
5. **TXN005 ↔ STMT005**: REF127, Amount: 234.50, Date: 2024-01-19  
6. **TXN006 ↔ STMT006**: REF128, Amount: 3456.78, Date: 2024-01-20  
7. **TXN007 ↔ STMT007**: REF129, Amount: 15000.00, Date: 2024-01-21  
8. **TXN008 ↔ STMT008**: REF130, Amount: 89.99, Date: 2024-01-22  
9. **TXN009 ↔ STMT009**: REF131, Amount: 5678.90, Date: 2024-01-23  
10. **TXN010 ↔ STMT010**: REF132, Amount: -200.00, Date: 2024-01-24  
11. **TXN011 ↔ STMT011**: REF133, Amount: 125.75, Date: 2024-01-25  
12. **TXN012 ↔ STMT012**: REF134, Amount: 567.89, Date: 2024-01-26  
13. **TXN013 ↔ STMT013**: REF135, Amount: 1000.00, Date: 2024-01-27  
14. **TXN014 ↔ STMT014**: REF136, Amount: 345.67, Date: 2024-01-28  
15. **TXN015 ↔ STMT015**: REF137, Amount: 29.99, Date: 2024-01-29  
16. **TXN016 ↔ STMT016**: REF138, Amount: 2345.67/2345.68 (tolerance), Date: 2024-01-30  
17. **TXN017 ↔ STMT017**: REF139, Amount: 500.00, Date: 2024-02-01  
18. **TXN018 ↔ STMT018**: REF140, Amount: 78.45, Date: 2024-02-02  
19. **TXN019 ↔ STMT019**: REF141, Amount: 1567.89, Date: 2024-02-03  
20. **TXN020 ↔ STMT020**: REF142, Amount: -25.00, Date: 2024-02-04  

#### Unmatched Records in File B
1. **STMT021**: REF999, Amount: 999.99, Date: 2024-02-05  
2. **STMT022**: REF888, Amount: 777.77, Date: 2024-02-06  

---

## Test Configuration Examples

### Basic Reconciliation Configuration
```json
{
  "Files": [
    {
      "Name": "FileA",
      "Extract": [
        {
          "ResultColumnName": "Extracted_Amount",
          "SourceColumn": "Amount_Text",
          "MatchType": "regex",
          "Patterns": ["\\$([0-9,]+(?:\\.[0-9]{2})?)"]
        }
      ],
      "Filter": [
        {
          "ColumnName": "Status",
          "MatchType": "equals",
          "Value": "Settled"
        }
      ]
    },
    {
      "Name": "FileB",
      "Extract": [],
      "Filter": [
        {
          "ColumnName": "Settlement_Status",
          "MatchType": "equals",
          "Value": "SETTLED"
        }
      ]
    }
  ],
  "ReconciliationRules": [
    {
      "LeftFileColumn": "Reference",
      "RightFileColumn": "Ref_Number",
      "MatchType": "equals",
      "ToleranceValue": 0
    },
    {
      "LeftFileColumn": "Extracted_Amount",
      "RightFileColumn": "Net_Amount",
      "MatchType": "tolerance",
      "ToleranceValue": 0.01
    }
  ]
}
```

### Advanced Multi-Rule Configuration
```json
{
  "Files": [
    {
      "Name": "FileA",
      "Extract": [
        {
          "ResultColumnName": "Clean_Amount",
          "SourceColumn": "Amount_Text",
          "MatchType": "regex",
          "Patterns": ["\\$([0-9,.-]+)"]
        }
      ],
      "Filter": [
        {
          "ColumnName": "Status",
          "MatchType": "equals",
          "Value": "Settled"
        },
        {
          "ColumnName": "Status",
          "MatchType": "equals",
          "Value": "Completed"
        }
      ]
    }
  ],
  "ReconciliationRules": [
    {
      "LeftFileColumn": "Reference",
      "RightFileColumn": "Ref_Number",
      "MatchType": "equals"
    },
    {
      "LeftFileColumn": "Account",
      "RightFileColumn": "Account_Number",
      "MatchType": "equals"
    },
    {
      "LeftFileColumn": "Customer_ID",
      "RightFileColumn": "Client_Code",
      "MatchType": "equals"
    },
    {
      "LeftFileColumn": "Clean_Amount",
      "RightFileColumn": "Net_Amount",
      "MatchType": "tolerance",
      "ToleranceValue": 0.05
    }
  ]
}
```

---

## Expected Output Columns

### Result Columns Selection
**File A Columns**: Transaction_ID, Date, Description, Amount_Text, Extracted_Amount, Status, Account, Reference, Customer_ID  
**File B Columns**: Statement_ID, Process_Date, Transaction_Desc, Net_Amount, Settlement_Status, Account_Number, Ref_Number, Client_Code  

### Match Status Categories
- **Matched**: Records that satisfy all reconciliation rules  
- **Unmatched_A**: Records in File A with no match in File B  
- **Unmatched_B**: Records in File B with no match in File A  
- **Partial_Match**: Records matching some but not all rules (if configured)

---

## Edge Cases Covered

1. **Negative Amounts**: -456.78, -200.00, -25.00  
2. **Large Numbers**: 15,000.00, 10,000.00  
3. **Small Decimals**: 29.99, 78.45, 89.99  
4. **Date Format Differences**: YYYY-MM-DD vs DD/MM/YYYY  
5. **Status Mapping**: Settled→SETTLED, Completed→COMPLETE, Pending→PROCESSING, Failed→REJECTED  
6. **Text vs Numeric Amounts**: "$1,234.56" vs 1234.56  
7. **Unmatched Records**: STMT021, STMT022 have no corresponding transactions  
8. **Near Matches**: Amounts differing by 0.01 to test tolerance rules  
9. **Multiple Filter Values**: Testing OR conditions within columns  
10. **Cross-Column Dependencies**: Customer_ID must match Client_Code AND Account must match Account_Number  

These test files provide comprehensive coverage for testing all reconciliation features including extraction, filtering, exact matching, tolerance matching, and handling of unmatched records.
