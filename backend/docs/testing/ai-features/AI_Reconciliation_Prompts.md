# AI Reconciliation Configuration Prompts - Testing Guide

This document provides comprehensive AI prompts for testing the reconciliation system across various business scenarios. Each prompt is designed to test different aspects of the AI configuration generation capability.
Ready-to-Use Test Scenarios

  1. Bank Reconciliation: Use existing recon_file_a.csv + recon_file_b.csv
  2. Expense Matching: Use new credit_card_transactions.csv + expense_receipts.csv
  3. AP Reconciliation: Use new invoice_register.csv + payment_records.csv

## Table of Contents
1. [Bank Statement Reconciliation](#bank-statement-reconciliation)
2. [Credit Card & Expense Reconciliation](#credit-card--expense-reconciliation)
3. [Invoice & Payment Reconciliation](#invoice--payment-reconciliation)
4. [Advanced Reconciliation Scenarios](#advanced-reconciliation-scenarios)
5. [Edge Cases & Error Testing](#edge-cases--error-testing)

---

## Bank Statement Reconciliation

### Prompt 1: Basic Bank Transaction Matching
```
Reconcile bank statements with internal transaction records using the following rules:
- Match by reference number (exact matching between Reference and Ref_Number columns)
- Match amounts with $0.01 tolerance (extract amount from Amount_Text column using regex)
- Convert dates from DD/MM/YYYY to YYYY-MM-DD format for comparison
- Only include transactions with status 'Settled' or 'Completed' from file A
- Only include statements with status 'SETTLED' or 'COMPLETE' from file B
- Match account numbers exactly (Account vs Account_Number)
```

**Expected Generated Rules:**
- Extract amount from `Amount_Text` using regex pattern
- Filter by status values
- Date format conversion
- Multiple exact match rules for Reference, Account
- Tolerance matching for amounts

### Prompt 2: Bank Reconciliation with Customer Validation
```
Match bank transactions with statements ensuring customer validation:
- Primary matching: Reference number must match exactly
- Secondary validation: Customer ID must match Client Code
- Amount matching with tolerance of $0.05 for rounding differences
- Include branch validation (Branch vs Location must match)
- Filter out any failed or rejected transactions
- Date matching within same day (handle different date formats)
```

**Expected Focus:** Multi-column validation rules, comprehensive filtering

---

## Credit Card & Expense Reconciliation

### Prompt 3: Credit Card Transaction Matching
```
Reconcile credit card transactions with expense receipts:
- Match transaction amounts exactly (handle negative values in credit card file)
- Match by date (Transaction_Date vs Date with format conversion DD/MM/YYYY to YYYY-MM-DD)
- Fuzzy match merchant names (Merchant_Name vs Vendor) to handle slight variations
- Only include POSTED transactions from credit card file
- Only include APPROVED receipts from expense file
- Authorization codes should be extracted from both files for validation
```

**Expected Features:** Negative amount handling, fuzzy matching, dual filtering

### Prompt 4: Employee Expense Reconciliation
```
Match employee credit card charges with submitted expense receipts:
- Amount matching with $0.50 tolerance for processing fees
- Date matching within 3 days to account for processing delays
- Category mapping between Transaction_Type and Category fields
- Employee validation using card numbers and Employee_ID
- Exclude cash advances and refunds from reconciliation
- Include project code validation where available
```

**Expected Features:** Date tolerance, category mapping, exclusion filters

---

## Invoice & Payment Reconciliation

### Prompt 5: Accounts Payable Reconciliation
```
Reconcile invoice register with payment records:
- Match using invoice numbers (Invoice_Number vs Invoice_Ref)
- Match vendor codes exactly (Vendor_ID vs Payee_Code)
- Amount matching should use Net_Amount vs Amount_Paid with $1.00 tolerance
- Only include APPROVED invoices, exclude CANCELLED and PENDING
- Only include PROCESSED payments
- Payment date should be after invoice date (validation rule)
- Match department codes for additional validation
```

**Expected Features:** Multi-field matching, status filtering, date logic validation

### Prompt 6: Vendor Payment Tracking
```
Track vendor payments against outstanding invoices:
- Primary match: Invoice reference numbers
- Secondary match: Vendor names with fuzzy matching (handle variations like "Corp" vs "Corporation")
- Amount validation with 2% tolerance for early payment discounts
- Payment method validation (track CHECK, ACH, WIRE separately)
- Due date analysis (flag late payments)
- Department code matching for approval validation
```

**Expected Features:** Fuzzy text matching, percentage tolerance, conditional logic

---

## Advanced Reconciliation Scenarios

### Prompt 7: Multi-Currency Reconciliation
```
Reconcile international transactions with different currencies:
- Match transaction IDs exactly
- Amount matching requires currency conversion (assume 1:1 for testing)
- Handle currency symbols ($, €, £) in amount extraction
- Date matching across time zones (use date only, ignore time)
- Country code validation for international transfers
- Exchange rate tolerance of 3% for amount differences
- Filter by transaction types: exclude internal transfers
```

**Expected Features:** Currency symbol handling, percentage tolerance, complex filtering

### Prompt 8: High-Volume Transaction Reconciliation
```
Reconcile large volume daily transactions:
- Batch processing by transaction date
- Amount matching with sliding tolerance (0.01 for amounts < 1000, 0.05 for amounts >= 1000)
- Reference number matching with pattern validation (must be 6-8 digits)
- Status mapping: "COMPLETE" = "SETTLED", "PROCESSING" = "PENDING"
- Exclude transactions below $10.00 from reconciliation
- Include settlement date validation (within 2 business days)
```

**Expected Features:** Conditional tolerance, pattern validation, business logic

---

## Edge Cases & Error Testing

### Prompt 9: Incomplete Data Handling
```
Reconcile transactions with missing or incomplete data:
- Match by available fields only when reference number is missing
- Use amount and date combination as backup matching strategy
- Handle blank customer IDs gracefully
- Fuzzy match descriptions when reference numbers don't match
- Tolerance matching for amounts up to $5.00
- Flag suspicious mismatches (same amount, different customers)
```

**Expected Features:** Fallback matching, error handling, validation logic

### Prompt 10: Complex Business Rules
```
Apply complex business validation rules:
- Weekend transactions require manual approval (flag for review)
- Amounts over $10,000 need dual authorization validation
- Customer credit limits must be validated against transaction amounts
- Refunds must match original transaction references
- Cross-reference transaction types with allowed categories per customer
- Generate exception reports for unmatched high-value transactions
```

**Expected Features:** Business logic validation, conditional processing, exception handling

### Prompt 11: Data Quality Issues
```
Handle data quality issues in reconciliation:
- Extract clean amounts from text with various formats ("$1,234.56", "1234.56 USD", "1,234.56-")
- Handle duplicate transaction IDs with sequence numbers
- Normalize vendor names (remove "Inc", "LLC", "Corp" suffixes for matching)
- Date validation and correction (handle invalid dates like 2024-02-30)
- Remove special characters from reference numbers for matching
- Handle encoding issues in text fields
```

**Expected Features:** Data cleaning, normalization, validation

### Prompt 12: Performance Optimization Scenario
```
Optimize reconciliation for large datasets:
- Prioritize exact matches first, then tolerance matches
- Use amount ranges for initial filtering (group similar amounts)
- Implement early termination for perfect matches
- Batch process by date ranges to reduce memory usage
- Create summary statistics for unmatched records
- Generate performance metrics for processing time
```

**Expected Features:** Processing optimization, performance considerations

---

## Testing Instructions

### How to Test Each Prompt

1. **Select Sample Files:**
   - Use `recon_file_a.csv` and `recon_file_b.csv` for basic scenarios
   - Use `credit_card_transactions.csv` and `expense_receipts.csv` for expense scenarios
   - Use `invoice_register.csv` and `payment_records.csv` for AP scenarios

2. **Input the Prompt:**
   - Copy the prompt text into the AI Requirements field
   - Ensure both files are selected before generating configuration

3. **Verify Generated Configuration:**
   - Check that extraction rules match the expected patterns
   - Verify filter rules include specified conditions
   - Confirm reconciliation rules use correct match types and tolerance values

4. **Run Reconciliation:**
   - Apply the generated configuration
   - Review match results and statistics
   - Validate that business logic is correctly applied

### Expected Success Criteria

- **Configuration Generation:** AI should generate valid JSON configuration within 10 seconds
- **Rule Accuracy:** Generated rules should match 90%+ of the requirements specified in the prompt
- **Data Processing:** Reconciliation should complete successfully with realistic match rates
- **Error Handling:** System should gracefully handle edge cases without crashing

### Common Issues to Test

1. **Ambiguous Requirements:** Test prompts with unclear or conflicting instructions
2. **Unsupported Features:** Request features not available in the system
3. **Invalid Data References:** Reference non-existent column names
4. **Complex Logic:** Test very complex business rules that may exceed AI capabilities
5. **Performance Limits:** Test with very large tolerance values or complex regex patterns

---

## Sample Expected Outputs

### For Prompt 1 (Basic Bank Reconciliation)
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
      "LeftFileColumn": "Clean_Amount",
      "RightFileColumn": "Net_Amount",
      "MatchType": "tolerance",
      "ToleranceValue": 0.01
    }
  ]
}
```

### For Prompt 3 (Credit Card Reconciliation)
```json
{
  "ReconciliationRules": [
    {
      "LeftFileColumn": "Amount",
      "RightFileColumn": "Total_Amount",
      "MatchType": "tolerance",
      "ToleranceValue": 0.00
    },
    {
      "LeftFileColumn": "Merchant_Name",
      "RightFileColumn": "Vendor",
      "MatchType": "fuzzy",
      "ToleranceValue": 0.8
    }
  ]
}
```

This comprehensive testing suite ensures thorough validation of the AI reconciliation configuration system across various business scenarios and edge cases.