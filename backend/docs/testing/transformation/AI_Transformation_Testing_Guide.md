# AI-Powered Transformation Flow Testing Guide

## Overview
This guide provides comprehensive testing scenarios for the AI-powered transformation configuration feature in the financial data processing platform.

## Test Data File
**Location**: `backend/docs/testing/transformation/customer_sales_test.csv`

### File Structure
The test file contains customer sales data with the following columns:
- `customer_id` - Unique customer identifier (CUST001-CUST015)
- `first_name`, `last_name` - Customer names
- `email`, `phone` - Contact information
- `purchase_date` - Date of purchase (2024-01-15 to 2024-01-29)
- `product_category` - Electronics, Clothing, Home & Garden, Books
- `product_name` - Specific product purchased
- `quantity` - Number of items
- `unit_price` - Price per item ($24.99 to $1299.99)
- `discount_percent` - Discount applied (0-25%)
- `payment_method` - Credit Card, PayPal, Debit Card
- `order_status` - Completed, Processing, Shipped, Cancelled
- `shipping_address` - Full address
- `region` - North, South, Central, West

## Test Scenarios

### 1. Basic Customer Report Generation
**Objective**: Create a simplified customer report with calculated fields

**AI Prompt**:
```
Create a customer summary report with the following requirements:
- Keep customer_id, first_name, last_name, and email from the source
- Add a full_name column by combining first_name and last_name
- Calculate total_amount as quantity * unit_price
- Add a customer_tier column: VIP for orders of unit_price > $500, STANDARD for orders $100-$500, BASIC for orders < $100
- Add a static batch_id column with value "BATCH_2024_Q1"
- Keep purchase_date and region columns
```

**Expected Output Columns**:
- customer_id, full_name, email, total_amount, discounted_amount, customer_tier, batch_id, purchase_date, region

### 2. Regional Sales Analysis
**Objective**: Transform data for regional sales reporting

**AI Prompt**:
```
Transform the sales data for regional analysis:
- Keep customer_id, purchase_date, and region
- Calculate line_total as quantity * unit_price * (1 - discount_percent/100)
- Add region_code: NOR for North, SOU for South, CEN for Central, WES for West
- Add sales_category based on line_total: HIGH (>$800), MEDIUM ($200-$800), LOW (<$200)
- Add quarter column with static value "Q1_2024"
- Include product_category and payment_method
```

**Expected Output Columns**:
- customer_id, purchase_date, region, region_code, line_total, sales_category, quarter, product_category, payment_method, processed_date

### 3. Product Performance Report
**Objective**: Create product-focused transformation with business logic

**AI Prompt**:
```
Generate a product performance report:
- Keep product_category, product_name, and quantity
- Calculate revenue as quantity * unit_price
- Calculate actual_revenue as revenue * (1 - discount_percent/100)
- Add performance_rating: EXCELLENT for actual_revenue > $1000, GOOD for $300-$1000, AVERAGE for < $300
- Add category_priority: 1 for Electronics, 2 for Clothing, 3 for Home & Garden, 4 for Books
- Include order_status and purchase_date
- Add report_type with static value "MONTHLY_PERFORMANCE"
- Add discount_tier: HIGH for discount_percent > 15%, MEDIUM for 5-15%, LOW for 0-5%
```

**Expected Output Columns**:
- product_category, product_name, quantity, revenue, actual_revenue, performance_rating, category_priority, order_status, purchase_date, report_type, discount_tier

### 4. Payment Analysis Transformation
**Objective**: Focus on payment method analysis with conditional logic

**AI Prompt**:
```
Create a payment analysis dataset:
- Keep customer_id, payment_method, and order_status
- Calculate order_value as quantity * unit_price
- Calculate final_amount as order_value * (1 - discount_percent/100)
- Add payment_risk_level: LOW for Credit Card, MEDIUM for Debit Card, HIGH for PayPal
- Add status_priority: 1 for Completed, 2 for Shipped, 3 for Processing, 4 for Cancelled
- Include region and purchase_date
- Add payment_fee_estimate: 2.9% of final_amount for Credit Card, 1.5% for Debit Card, 3.5% for PayPal
- Add analysis_date with static value "2024-01-30"
```

**Expected Output Columns**:
- customer_id, payment_method, order_status, order_value, final_amount, payment_risk_level, status_priority, region, purchase_date, payment_fee_estimate, analysis_date

### 5. Complex Multi-Condition Transformation
**Objective**: Test complex business logic with multiple conditions

**AI Prompt**:
```
Create a comprehensive business intelligence report:
- Keep customer_id, first_name, last_name
- Calculate gross_revenue as quantity * unit_price
- Calculate net_revenue as gross_revenue * (1 - discount_percent/100)
- Add customer_segment based on multiple conditions:
  * PREMIUM: Electronics category AND net_revenue > $800
  * REGULAR: Any category AND net_revenue $200-$800 AND region is North or West
  * BUDGET: All other combinations
- Add order_priority: URGENT for Processing status, HIGH for Shipped, NORMAL for Completed, LOW for Cancelled
- Include product_category, region, and order_status
- Add profit_margin_estimate as 30% of net_revenue for Electronics, 40% for Clothing, 25% for Home & Garden, 50% for Books
- Add last_updated with static value "2024-01-30 15:30:00"
```

**Expected Output Columns**:
- customer_id, first_name, last_name, gross_revenue, net_revenue, customer_segment, order_priority, product_category, region, order_status, profit_margin_estimate, last_updated

## Testing Steps

### Step 1: Upload Test File
1. Start the backend server: `cd backend && python app/main.py`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to the transformation flow
4. Upload the `customer_sales_test.csv` file

### Step 2: Test AI Configuration Generation
1. Select the uploaded file in the transformation flow
2. In the AI Requirements step, enter one of the test prompts above
3. Click "Generate Configuration"
4. Review the generated configuration for accuracy
5. Verify the output columns match expected results

### Step 3: Validate Generated Rules
1. Check that the AI correctly mapped source columns
2. Verify conditional logic is properly structured
3. Ensure static values are correctly assigned
4. Confirm calculated fields use proper formulas

### Step 4: Execute Transformation
1. Proceed to the rule configuration step
2. Make any necessary adjustments to the AI-generated rules
3. Execute the transformation
4. Review the output data for correctness

### Step 5: Manual Override Testing
1. Click "Skip AI & Configure Manually" 
2. Manually configure the same transformation
3. Compare results with AI-generated configuration
4. Verify both approaches produce similar outputs

## Expected Results Validation

### Configuration Generation
- **Response Time**: Should complete within 10-30 seconds
- **Rule Structure**: Proper JSON structure with all required fields
- **Column Mapping**: Accurate mapping of source to target columns
- **Business Logic**: Conditional statements properly formatted
- **Static Values**: Correctly assigned fixed values

### Data Transformation
- **Row Count**: Should match input data (15 rows)
- **Column Count**: Should match expected output structure
- **Data Types**: Proper numeric calculations and string formatting
- **Business Rules**: Conditional logic applied correctly
- **Null Handling**: Appropriate handling of missing values

## Common Issues and Troubleshooting

### AI Configuration Issues
1. **Empty Response**: Check OpenAI API key configuration in `.env`
2. **Invalid JSON**: Review the AI prompt for clarity and specificity
3. **Missing Columns**: Ensure source column names are correctly referenced
4. **Timeout Errors**: Reduce prompt complexity or check API limits

### Transformation Errors
1. **Column Mapping Errors**: Verify source column names exist in the data
2. **Formula Errors**: Check calculated field syntax
3. **Condition Logic**: Review conditional statements for proper operators
4. **Data Type Issues**: Ensure numeric operations use proper data types

## Performance Benchmarks

### AI Generation Performance
- **Simple Transformation (1-3 rules)**: 5-15 seconds
- **Medium Complexity (4-7 rules)**: 15-25 seconds
- **Complex Transformation (8+ rules)**: 25-40 seconds

### Data Processing Performance
- **15 rows**: < 1 second
- **100 rows**: 1-2 seconds
- **1,000 rows**: 2-5 seconds
- **10,000 rows**: 10-30 seconds

## Best Practices for AI Prompts

### Effective Prompt Structure
1. **Clear Objective**: Start with what you want to achieve
2. **Specific Requirements**: List exact column transformations needed
3. **Business Logic**: Explain conditional rules clearly
4. **Static Values**: Specify fixed values with clear labels
5. **Output Format**: Describe expected column structure

### Example Good Prompt
```
Create a sales summary report where:
- Keep customer_id and purchase_date from source
- Calculate total_sale as quantity * unit_price
- Add customer_type: PREMIUM if total_sale > 500, otherwise STANDARD
- Add static report_date with value "2024-01-30"
```

### Example Poor Prompt
```
Transform the data and make it better for reporting
```

## Future Enhancements

### Planned Features
1. **Template Library**: Save successful AI configurations as reusable templates
2. **Validation Rules**: AI-generated data validation rules
3. **Performance Optimization**: Caching of similar transformation patterns
4. **Multi-file Support**: AI configuration for complex multi-file transformations
5. **Interactive Refinement**: Conversational AI for iterative configuration improvement

This testing guide provides comprehensive coverage of the AI-powered transformation feature and serves as a reference for future development and testing efforts.