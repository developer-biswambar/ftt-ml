# Comprehensive Transformation Testing Guide

## Overview
This guide provides incremental test scenarios to validate all transformation features using the provided test files:
- `source_customer_data.csv` (20 customer records)
- `source_transaction_data.csv` (25 transaction records)  
- `source_product_data.csv` (24 product records)

## Test Files Structure

### Customer Data (20 records)
- **Key Features**: Personal info, account types, balances, membership levels
- **Data Types**: Strings, numbers, dates, enums
- **Use Cases**: Direct mapping, static values, conditional logic

### Transaction Data (25 records)
- **Key Features**: Purchase history, amounts, discounts, channels
- **Data Types**: IDs, amounts, percentages, categories
- **Use Cases**: Calculations, aggregations, lookups

### Product Data (24 records)
- **Key Features**: Product details, pricing, inventory, specifications
- **Data Types**: Codes, prices, dimensions, materials
- **Use Cases**: Joins, complex transformations, enrichment

---

## Test Scenarios (Incremental)

### 🎯 **Level 1: Basic Direct Mapping**
**Goal**: Test simple column-to-column mapping without transformations

#### Configuration:
```json
{
  "name": "Basic Customer Mapping",
  "description": "Simple direct mapping of customer fields",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Main customer data source"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_001",
      "name": "Direct Customer Mapping",
      "enabled": true,
      "priority": 0,
      "condition": "",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002", 
          "name": "full_name",
          "mapping_type": "static",
          "static_value": "{First_Name} {Last_Name}"
        },
        {
          "id": "col_003",
          "name": "email",
          "mapping_type": "direct",
          "source_column": "Email"
        },
        {
          "id": "col_004",
          "name": "balance",
          "mapping_type": "direct",
          "source_column": "Balance"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Create a basic transformation that maps customer data to a simplified format. Include customer_id (direct from Customer_ID), full_name (combine First_Name and Last_Name), email (direct from Email), and balance (direct from Balance)."
```

#### Expected Results:
- **Input Rows**: 20 customers
- **Output Rows**: 20 records
- **Output Columns**: customer_id, full_name, email, balance
- **Tests**: Direct mapping, static expressions

---

### 🎯 **Level 2: Static Value Assignment**
**Goal**: Test static value assignment and expressions

#### Configuration:
```json
{
  "name": "Customer Enrichment with Static Values",
  "description": "Add static computed fields to customer data",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Customer data with static enrichment"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_002",
      "name": "Customer Enrichment",
      "enabled": true,
      "priority": 0,
      "condition": "",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002",
          "name": "full_name", 
          "mapping_type": "static",
          "static_value": "{First_Name} {Last_Name}"
        },
        {
          "id": "col_003",
          "name": "data_source",
          "mapping_type": "static",
          "static_value": "Customer Master File"
        },
        {
          "id": "col_004",
          "name": "processing_date",
          "mapping_type": "static",
          "static_value": "2024-01-31"
        },
        {
          "id": "col_005",
          "name": "account_summary",
          "mapping_type": "static", 
          "static_value": "{Account_Type} account with balance ${Balance}"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Transform customer data by adding static fields: data_source='Customer Master File', processing_date='2024-01-31', and account_summary that combines account type and balance in a readable format."
```

#### Expected Results:
- **Input Rows**: 20 customers
- **Output Rows**: 20 records
- **Tests**: Static values, date literals, expression interpolation

---

### 🎯 **Level 3: Conditional Logic (Dynamic Mapping)**
**Goal**: Test conditional logic based on source data values

#### Configuration:
```json
{
  "name": "Customer Tier Classification",
  "description": "Classify customers based on balance and account type", 
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Customer classification"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_003",
      "name": "Customer Classification",
      "enabled": true,
      "priority": 0,
      "condition": "",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002",
          "name": "customer_tier",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001",
              "condition_column": "Balance",
              "operator": ">=",
              "condition_value": "20000",
              "output_value": "VIP"
            },
            {
              "id": "cond_002", 
              "condition_column": "Balance",
              "operator": ">=",
              "condition_value": "10000",
              "output_value": "Premium"
            },
            {
              "id": "cond_003",
              "condition_column": "Balance", 
              "operator": ">=",
              "condition_value": "1000",
              "output_value": "Standard"
            }
          ],
          "default_value": "Basic"
        },
        {
          "id": "col_003",
          "name": "status_description",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_004",
              "condition_column": "Status",
              "operator": "==", 
              "condition_value": "Active",
              "output_value": "Account is active and in good standing"
            },
            {
              "id": "cond_005",
              "condition_column": "Status",
              "operator": "==",
              "condition_value": "Suspended",
              "output_value": "Account is temporarily suspended"
            }
          ],
          "default_value": "Account status requires review"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Create customer tiers based on balance: VIP (≥$20k), Premium (≥$10k), Standard (≥$1k), Basic (others). Also add status descriptions for Active, Suspended, and other statuses."
```

#### Expected Results:
- **Input Rows**: 20 customers
- **Output Rows**: 20 records  
- **VIP Customers**: 4 (CUST004, CUST007, CUST010, CUST016, CUST019)
- **Premium Customers**: 3 (CUST001, CUST007, CUST013)
- **Tests**: Numeric comparisons, string equality, default values

---

### 🎯 **Level 4: Multiple Rules with Conditions**
**Goal**: Test multiple transformation rules with conditional execution

#### Configuration:
```json
{
  "name": "Conditional Customer Processing",
  "description": "Process different customer types with different rules",
  "source_files": [
    {
      "file_id": "customer_file_id", 
      "alias": "customers",
      "purpose": "Multi-rule customer processing"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_004a",
      "name": "Premium Customer Processing",
      "enabled": true,
      "priority": 1,
      "condition": "Balance >= 10000",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002",
          "name": "customer_type",
          "mapping_type": "static",
          "static_value": "Premium Customer"
        },
        {
          "id": "col_003",
          "name": "special_offers",
          "mapping_type": "static", 
          "static_value": "VIP Rewards, Priority Support, Exclusive Deals"
        },
        {
          "id": "col_004",
          "name": "account_manager",
          "mapping_type": "static",
          "static_value": "Senior Account Manager"
        }
      ]
    },
    {
      "id": "rule_004b",
      "name": "Standard Customer Processing", 
      "enabled": true,
      "priority": 2,
      "condition": "Balance < 10000 AND Status == 'Active'",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002",
          "name": "customer_type",
          "mapping_type": "static",
          "static_value": "Standard Customer"
        },
        {
          "id": "col_003",
          "name": "special_offers",
          "mapping_type": "static",
          "static_value": "Standard Rewards, Email Support"
        },
        {
          "id": "col_004", 
          "name": "account_manager",
          "mapping_type": "static",
          "static_value": "Customer Service Team"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Create two different processing rules: one for premium customers (balance ≥ $10k) with VIP benefits, and another for standard active customers (balance < $10k, status = Active) with standard benefits."
```

#### Expected Results:
- **Premium Rule**: ~7 customers processed
- **Standard Rule**: ~10 customers processed  
- **Total Output**: ~17 rows (some customers may not match either condition)
- **Tests**: Rule conditions, priority ordering, conditional execution

---

### 🎯 **Level 5: Data Joining/Lookup**
**Goal**: Test joining data from multiple source files

#### Configuration:
```json
{
  "name": "Customer Transaction Summary",
  "description": "Join customer and transaction data",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers", 
      "purpose": "Customer master data"
    },
    {
      "file_id": "transaction_file_id",
      "alias": "transactions",
      "purpose": "Transaction history"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_005",
      "name": "Customer Transaction Join",
      "enabled": true,
      "priority": 0,
      "condition": "",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "customers.Customer_ID"
        },
        {
          "id": "col_002",
          "name": "customer_name",
          "mapping_type": "static",
          "static_value": "{customers.First_Name} {customers.Last_Name}"
        },
        {
          "id": "col_003",
          "name": "transaction_id", 
          "mapping_type": "direct",
          "source_column": "transactions.Transaction_ID"
        },
        {
          "id": "col_004",
          "name": "product_name",
          "mapping_type": "direct",
          "source_column": "transactions.Product_Name"
        },
        {
          "id": "col_005",
          "name": "amount",
          "mapping_type": "direct",
          "source_column": "transactions.Amount"
        },
        {
          "id": "col_006",
          "name": "customer_tier",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001",
              "condition_column": "customers.Balance",
              "operator": ">=",
              "condition_value": "15000",
              "output_value": "VIP"
            }
          ],
          "default_value": "Standard"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Join customer and transaction data to create a customer transaction summary. Include customer details, transaction info, and determine customer tier based on balance."
```

#### Expected Results:
- **Input**: 20 customers × 25 transactions = potential 500 combinations
- **Actual Output**: ~25 rows (only matching Customer_IDs)
- **Tests**: Multi-file joins, qualified column references, cross-file conditions

---

### 🎯 **Level 6: Aggregation and Calculations**
**Goal**: Test aggregation functions and mathematical calculations

#### Configuration:
```json
{
  "name": "Customer Purchase Analytics", 
  "description": "Calculate customer purchase statistics",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Customer data"
    },
    {
      "file_id": "transaction_file_id", 
      "alias": "transactions",
      "purpose": "Transaction data for aggregation"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_006",
      "name": "Customer Analytics",
      "enabled": true,
      "priority": 0,
      "condition": "",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct", 
          "source_column": "customers.Customer_ID"
        },
        {
          "id": "col_002",
          "name": "customer_name",
          "mapping_type": "static",
          "static_value": "{customers.First_Name} {customers.Last_Name}"
        },
        {
          "id": "col_003",
          "name": "total_purchases",
          "mapping_type": "static",
          "static_value": "COUNT(transactions.Transaction_ID WHERE transactions.Customer_ID = customers.Customer_ID)"
        },
        {
          "id": "col_004", 
          "name": "total_spent",
          "mapping_type": "static",
          "static_value": "SUM(transactions.Amount WHERE transactions.Customer_ID = customers.Customer_ID)"
        },
        {
          "id": "col_005",
          "name": "avg_purchase_amount", 
          "mapping_type": "static",
          "static_value": "AVG(transactions.Amount WHERE transactions.Customer_ID = customers.Customer_ID)"
        },
        {
          "id": "col_006",
          "name": "customer_value_rating",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001",
              "condition_column": "total_spent",
              "operator": ">=",
              "condition_value": "1000", 
              "output_value": "High Value"
            },
            {
              "id": "cond_002",
              "condition_column": "total_spent",
              "operator": ">=", 
              "condition_value": "500",
              "output_value": "Medium Value"
            }
          ],
          "default_value": "Low Value"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Create customer analytics by calculating total purchases, total amount spent, and average purchase amount per customer. Then classify customers as High Value (≥$1000), Medium Value (≥$500), or Low Value."
```

#### Expected Results:
- **Input**: 20 customers with transaction aggregations
- **Output**: 20 customer analytics records
- **Tests**: Aggregation functions, mathematical calculations, derived conditions

---

### 🎯 **Level 7: Row Expansion/Duplication**
**Goal**: Test row generation and expansion strategies

#### Configuration:
```json
{
  "name": "Monthly Customer Reports",
  "description": "Generate monthly records for each customer",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Base customer data for expansion"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_007",
      "name": "Monthly Record Generation",
      "enabled": true,
      "priority": 0,
      "condition": "Status == 'Active'",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002",
          "name": "customer_name",
          "mapping_type": "static", 
          "static_value": "{First_Name} {Last_Name}"
        },
        {
          "id": "col_003",
          "name": "report_month",
          "mapping_type": "static",
          "static_value": "EXPAND_LIST(['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'])"
        },
        {
          "id": "col_004",
          "name": "monthly_fee",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001",
              "condition_column": "Account_Type",
              "operator": "==",
              "condition_value": "Premium",
              "output_value": "25.00"
            },
            {
              "id": "cond_002",
              "condition_column": "Account_Type", 
              "operator": "==",
              "condition_value": "Standard",
              "output_value": "15.00"
            }
          ],
          "default_value": "5.00"
        },
        {
          "id": "col_005",
          "name": "record_type",
          "mapping_type": "static",
          "static_value": "Monthly Statement"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Generate monthly records for each active customer for 6 months (Jan-Jun 2024). Set monthly fees based on account type: Premium=$25, Standard=$15, Basic=$5."
```

#### Expected Results:
- **Active Customers**: ~16 customers  
- **Output Rows**: ~96 records (16 customers × 6 months)
- **Tests**: Row expansion, list iteration, conditional expansion

---

### 🎯 **Level 8: Complex Multi-File Transformation**
**Goal**: Test complex transformation with all three source files

#### Configuration:
```json
{
  "name": "Complete Sales Analysis",
  "description": "Comprehensive transformation using all source files",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Customer master data"
    },
    {
      "file_id": "transaction_file_id",
      "alias": "transactions", 
      "purpose": "Transaction history"
    },
    {
      "file_id": "product_file_id",
      "alias": "products",
      "purpose": "Product catalog"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_008",
      "name": "Sales Analysis Report",
      "enabled": true,
      "priority": 0,
      "condition": "transactions.Transaction_Type == 'Purchase'",
      "output_columns": [
        {
          "id": "col_001",
          "name": "transaction_id",
          "mapping_type": "direct",
          "source_column": "transactions.Transaction_ID"
        },
        {
          "id": "col_002", 
          "name": "customer_name",
          "mapping_type": "static",
          "static_value": "{customers.First_Name} {customers.Last_Name}"
        },
        {
          "id": "col_003",
          "name": "customer_tier",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001",
              "condition_column": "customers.Balance",
              "operator": ">=",
              "condition_value": "15000",
              "output_value": "VIP"
            },
            {
              "id": "cond_002",
              "condition_column": "customers.Balance",
              "operator": ">=", 
              "condition_value": "5000",
              "output_value": "Premium"
            }
          ],
          "default_value": "Standard"
        },
        {
          "id": "col_004",
          "name": "product_name",
          "mapping_type": "direct",
          "source_column": "products.Product_Name"
        },
        {
          "id": "col_005",
          "name": "category",
          "mapping_type": "direct", 
          "source_column": "products.Category"
        },
        {
          "id": "col_006",
          "name": "sale_amount",
          "mapping_type": "direct",
          "source_column": "transactions.Amount"
        },
        {
          "id": "col_007",
          "name": "profit_margin",
          "mapping_type": "static",
          "static_value": "((transactions.Amount - products.Cost_Price) / transactions.Amount) * 100"
        },
        {
          "id": "col_008",
          "name": "sale_performance",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_003",
              "condition_column": "profit_margin",
              "operator": ">=",
              "condition_value": "50",
              "output_value": "Excellent" 
            },
            {
              "id": "cond_004",
              "condition_column": "profit_margin",
              "operator": ">=",
              "condition_value": "30",
              "output_value": "Good"
            }
          ],
          "default_value": "Fair"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Create a comprehensive sales analysis joining all three files. Include customer tiers, product details, profit calculations, and performance ratings. Only include Purchase transactions."
```

#### Expected Results:
- **Purchase Transactions**: ~24 (excluding returns)
- **Output Rows**: ~24 comprehensive sales records
- **Tests**: 3-file joins, complex calculations, nested conditions

---

### 🎯 **Level 9: Advanced Expression Evaluation**
**Goal**: Test complex expressions and functions

#### Configuration:
```json
{
  "name": "Advanced Customer Metrics",
  "description": "Complex calculations and advanced expressions", 
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Customer data for advanced metrics"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_009",
      "name": "Advanced Metrics Calculation",
      "enabled": true,
      "priority": 0,
      "condition": "",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_id",
          "mapping_type": "direct",
          "source_column": "Customer_ID"
        },
        {
          "id": "col_002",
          "name": "account_age_days",
          "mapping_type": "static",
          "static_value": "DATEDIFF('2024-01-31', Date_Joined)"
        },
        {
          "id": "col_003",
          "name": "account_age_category", 
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001", 
              "condition_column": "account_age_days",
              "operator": ">=",
              "condition_value": "365",
              "output_value": "Veteran"
            },
            {
              "id": "cond_002",
              "condition_column": "account_age_days",
              "operator": ">=", 
              "condition_value": "90",
              "output_value": "Established"
            },
            {
              "id": "cond_003",
              "condition_column": "account_age_days",
              "operator": ">=",
              "condition_value": "30", 
              "output_value": "Regular"
            }
          ],
          "default_value": "New"
        },
        {
          "id": "col_004",
          "name": "balance_formatted",
          "mapping_type": "static",
          "static_value": "CONCAT('$', FORMAT(Balance, '###,##0.00'))"
        },
        {
          "id": "col_005",
          "name": "risk_score",
          "mapping_type": "static", 
          "static_value": "CASE WHEN Status = 'Suspended' THEN 100 WHEN Balance < 1000 THEN 75 WHEN Account_Type = 'Basic' THEN 50 ELSE 25 END"
        },
        {
          "id": "col_006",
          "name": "email_domain",
          "mapping_type": "static",
          "static_value": "SUBSTRING(Email, CHARINDEX('@', Email) + 1, LEN(Email))"
        }
      ]
    }
  ]
}
```

#### AI Prompt:
```
"Calculate advanced customer metrics including account age in days, formatted balance with currency, risk scores based on multiple factors, and extract email domains from email addresses."
```

#### Expected Results:
- **Input Rows**: 20 customers
- **Output Rows**: 20 records with advanced calculations
- **Tests**: Date functions, string functions, conditional expressions, formatting

---

### 🎯 **Level 10: Complete Enterprise Scenario**
**Goal**: Test most complex transformation with all features

#### Configuration:
```json
{
  "name": "Enterprise Customer Intelligence",
  "description": "Complete transformation with all advanced features",
  "source_files": [
    {
      "file_id": "customer_file_id",
      "alias": "customers",
      "purpose": "Customer master data"
    },
    {
      "file_id": "transaction_file_id",
      "alias": "transactions",
      "purpose": "Transaction history"
    },
    {
      "file_id": "product_file_id",
      "alias": "products", 
      "purpose": "Product catalog"
    }
  ],
  "row_generation_rules": [
    {
      "id": "rule_010a",
      "name": "VIP Customer Intelligence",
      "enabled": true,
      "priority": 1,
      "condition": "customers.Balance >= 15000 AND customers.Status = 'Active'",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_intelligence_id",
          "mapping_type": "static",
          "static_value": "VIP_{customers.Customer_ID}_{YEAR(customers.Date_Joined)}"
        },
        {
          "id": "col_002",
          "name": "customer_profile",
          "mapping_type": "static",
          "static_value": "VIP: {customers.First_Name} {customers.Last_Name} ({customers.Age}y, {customers.Gender})"
        },
        {
          "id": "col_003",
          "name": "financial_summary",
          "mapping_type": "static",
          "static_value": "{customers.Account_Type} account: ${customers.Balance:###,##0.00} ({customers.Membership_Level} member)"
        },
        {
          "id": "col_004",
          "name": "purchase_analytics",
          "mapping_type": "static",
          "static_value": "Total Purchases: COUNT(transactions) | Avg: $AVG(transactions.Amount) | Categories: DISTINCT_COUNT(products.Category)"
        },
        {
          "id": "col_005",
          "name": "loyalty_score",
          "mapping_type": "static",
          "static_value": "(DATEDIFF('2024-01-31', customers.Date_Joined) * 0.1) + (customers.Balance / 1000) + (COUNT(transactions) * 5)"
        },
        {
          "id": "col_006",
          "name": "recommendations",
          "mapping_type": "static",
          "static_value": "EXPAND_LIST(['Private Banking Services', 'Investment Advisory', 'Concierge Support', 'Exclusive Events'])"
        }
      ]
    },
    {
      "id": "rule_010b", 
      "name": "Standard Customer Intelligence",
      "enabled": true,
      "priority": 2,
      "condition": "customers.Balance < 15000 AND customers.Status = 'Active'",
      "output_columns": [
        {
          "id": "col_001",
          "name": "customer_intelligence_id",
          "mapping_type": "static",
          "static_value": "STD_{customers.Customer_ID}_{YEAR(customers.Date_Joined)}"
        },
        {
          "id": "col_002",
          "name": "customer_profile", 
          "mapping_type": "static",
          "static_value": "Standard: {customers.First_Name} {customers.Last_Name} ({customers.Region})"
        },
        {
          "id": "col_003",
          "name": "growth_potential",
          "mapping_type": "dynamic",
          "dynamic_conditions": [
            {
              "id": "cond_001",
              "condition_column": "customers.Age",
              "operator": "<",
              "condition_value": "30",
              "output_value": "High Growth Potential"
            },
            {
              "id": "cond_002",
              "condition_column": "customers.Balance",
              "operator": ">",
              "condition_value": "5000", 
              "output_value": "Medium Growth Potential"
            }
          ],
          "default_value": "Standard Growth Potential"
        },
        {
          "id": "col_004",
          "name": "engagement_recommendations",
          "mapping_type": "static",
          "static_value": "EXPAND_LIST(['Email Promotions', 'Loyalty Program', 'Product Recommendations'])"
        }
      ]
    }
  ],
  "validation_rules": [
    {
      "id": "val_001",
      "name": "Required Fields",
      "type": "required",
      "config": {
        "columns": ["customer_intelligence_id", "customer_profile"]
      },
      "error_message": "Customer intelligence ID and profile are required",
      "severity": "error"
    }
  ]
}
```

#### AI Prompt:
```
"Create a comprehensive customer intelligence system that processes VIP customers (balance ≥ $15k) differently from standard customers. Include loyalty scoring, personalized recommendations, purchase analytics, and growth potential assessment. Add validation rules for data quality."
```

#### Expected Results:
- **VIP Processing**: ~6 customers with expanded recommendations (24 records)
- **Standard Processing**: ~11 customers with growth analysis (33 records)  
- **Total Output**: ~57 records
- **Tests**: All features combined, validation rules, complex expressions, row expansion

---

## Test Validation Checklist

### ✅ **For Each Test Level:**
1. **File Upload**: All source files upload successfully
2. **Configuration**: JSON validates without errors
3. **Execution**: Transformation completes without errors
4. **Row Counts**: Match expected input/output counts
5. **Data Quality**: Spot check output data accuracy
6. **Performance**: Reasonable processing time
7. **Memory Usage**: No memory issues with larger datasets

### ✅ **Feature Coverage:**
- [ ] Direct column mapping
- [ ] Static value assignment
- [ ] Expression evaluation
- [ ] Conditional logic (dynamic mapping)
- [ ] Multiple rule execution
- [ ] Multi-file joins/lookups
- [ ] Aggregation functions
- [ ] Row expansion/duplication
- [ ] Complex calculations
- [ ] Advanced expressions
- [ ] Validation rules
- [ ] Error handling

### ✅ **Data Type Coverage:**
- [ ] Strings (names, descriptions)
- [ ] Numbers (balances, amounts, ages)
- [ ] Dates (join dates, transaction dates)
- [ ] Booleans (status flags)
- [ ] Enums (account types, statuses)
- [ ] Arrays (recommendations, lists)

### ✅ **Expression Functions Tested:**
- [ ] String functions (CONCAT, SUBSTRING, etc.)
- [ ] Date functions (DATEDIFF, YEAR, etc.)
- [ ] Math functions (SUM, AVG, COUNT, etc.)
- [ ] Conditional functions (CASE, IF, etc.)
- [ ] Formatting functions (FORMAT, etc.)
- [ ] Aggregation functions (SUM, AVG, COUNT, etc.)

---

## Quick Reference

### **Source File Columns:**

#### Customer Data:
- Customer_ID, First_Name, Last_Name, Email, Phone
- Date_Joined, Account_Type, Balance, Status, Region
- City, Age, Gender, Membership_Level, Last_Login

#### Transaction Data:
- Transaction_ID, Customer_ID, Product_Code, Product_Name
- Category, Transaction_Date, Amount, Quantity, Unit_Price
- Discount_Percent, Payment_Method, Channel, Sales_Rep
- Transaction_Type, Currency

#### Product Data:
- Product_Code, Product_Name, Category, Subcategory, Brand
- Cost_Price, Retail_Price, Supplier, Stock_Quantity
- Reorder_Level, Weight_Kg, Dimensions, Color, Material, Warranty_Months

### **Test Data Highlights:**
- **VIP Customers**: CUST004 ($25k), CUST010 ($22k), CUST019 ($21.5k)
- **Premium Customers**: CUST001 ($15k), CUST007 ($18.5k), CUST013 ($16.7k), CUST016 ($19.2k)
- **Suspended Customers**: CUST007, CUST018
- **Return Transaction**: TXN011 (CUST001 returning office chair)
- **High Discount Items**: Various products with 10-20% discounts
- **Multiple Categories**: Electronics, Furniture, Appliances, Stationery, etc.

This comprehensive guide provides everything needed to test all transformation features incrementally! 🚀