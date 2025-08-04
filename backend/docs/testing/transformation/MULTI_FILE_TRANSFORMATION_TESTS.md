# 🔗 Multi-File Integration Transformation Testing Guide

## Overview
This guide focuses on testing transformation scenarios that integrate **multiple CSV files** together. These tests demonstrate complex data relationships, joins, and comprehensive business intelligence scenarios.

## 📁 Test Files Required
- **customers_test.csv** (10 records) - Customer master data
- **transactions_test.csv** (12 records) - Transaction history  
- **products_test.csv** (11 records) - Product catalog

## 🚀 Prerequisites
1. Start backend server: `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Open browser: `http://localhost:8000`
3. Upload **ALL THREE** CSV files before starting tests

---

# 🧪 Multi-File Integration Tests

## 🎯 **Test M1: Complete Sales Analysis (3-File Join)**

### Steps:
1. Upload **ALL THREE** CSV files
2. Go to **AI Assistance**
3. **SELECT ALL THREE FILES** in the interface
4. Enter this prompt:

**🤖 PROMPT:**
```
Create a comprehensive sales analysis joining customers, transactions, and products. Include customer tiers based on balance, product profitability, transaction summaries, and sales performance metrics. Only include Purchase transactions (exclude Returns).
```

### ✅ **Expected Results:**
- **Records**: ~11 records (Purchase transactions only, excluding TXN011 return)
- **Customer Info**: Name, tier, balance, region
- **Product Info**: Name, category, cost/retail prices, profit margins
- **Transaction Info**: Amount, discount, payment method, channel
- **Calculated Fields**: Customer tier, profit per transaction, sales performance

---

## 🎯 **Test M2: Customer Transaction History with Product Details**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Create detailed customer transaction histories combining customer profiles, product specifications, and purchase behavior. Generate comprehensive customer profiles with all their purchases, product preferences, and spending analytics.
```

### ✅ **Expected Results:**
- **Customer Profiles**: Full customer information with demographics
- **Purchase History**: All transactions per customer with product details
- **Product Specifications**: Brand, category, warranty, materials
- **Behavioral Analytics**: Spending patterns, category preferences, channel usage

---

## 🎯 **Test M3: Product Performance with Customer Insights**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Analyze product performance by combining sales data with customer demographics and purchase patterns. Show which products appeal to which customer segments, profitability by customer tier, and market penetration analysis.
```

### ✅ **Expected Results:**
- **Product Sales**: Units sold, revenue generated, customer types
- **Customer Segmentation**: Which customer tiers buy which products
- **Market Analysis**: Product popularity by region, age group, membership level
- **Profitability Insights**: Profit margins with customer value correlation

---

## 🎯 **Test M4: Sales Representative Performance Dashboard**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Create a comprehensive sales representative dashboard combining rep performance with customer relationships and product mix. Analyze rep effectiveness, customer satisfaction indicators, and product portfolio management.
```

### ✅ **Expected Results:**
- **Rep Performance**: Total sales, transaction count, average deal size
- **Customer Relationships**: Customer tiers served, retention indicators
- **Product Mix**: Categories sold, profitability per rep, product expertise
- **Performance Metrics**: Revenue per rep, customer satisfaction scores

---

## 🎯 **Test M5: Return Analysis with Customer and Product Context**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Analyze returns and refunds by combining transaction data with customer profiles and product characteristics. Identify return patterns, customer satisfaction issues, and product quality indicators.
```

### ✅ **Expected Results:**
- **Return Details**: TXN011 (Office Chair return by CUST001)
- **Customer Context**: Customer profile, purchase history, loyalty status
- **Product Analysis**: Product specifications, warranty, quality indicators
- **Business Impact**: Revenue impact, customer satisfaction flags, process improvements

---

## 🎯 **Test M6: Regional Sales and Market Analysis**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Create regional market analysis combining customer locations, transaction patterns, and product preferences by geography. Analyze market penetration, regional preferences, and growth opportunities.
```

### ✅ **Expected Results:**
- **Regional Breakdown**: Sales by North, South, East, West, Central regions
- **Product Preferences**: Which products sell best in which regions
- **Customer Demographics**: Age, income (balance), membership by region
- **Market Opportunities**: Underserved regions, product gaps, growth potential

---

## 🎯 **Test M7: Channel and Payment Method Analysis**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Analyze sales channels and payment preferences by combining customer demographics, product categories, and transaction methods. Identify optimal channel strategies and payment optimization opportunities.
```

### ✅ **Expected Results:**
- **Channel Analysis**: Online vs Store sales by customer type and product
- **Payment Preferences**: Credit/Debit/Cash/PayPal usage by demographics
- **Product-Channel Fit**: Which products sell better online vs in-store
- **Customer Experience**: Channel preference by customer tier and age

---

## 🎯 **Test M8: Inventory Planning with Customer Demand**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Create inventory planning insights by combining product stock levels with customer demand patterns and sales velocity. Optimize inventory based on customer preferences and transaction history.
```

### ✅ **Expected Results:**
- **Demand Analysis**: Which products are purchased by which customer segments
- **Stock Optimization**: Inventory levels vs actual demand patterns
- **Customer Impact**: How stock levels affect customer satisfaction
- **Reorder Priorities**: Inventory planning based on customer value and demand

---

## 🎯 **Test M9: Customer Lifetime Value with Product Mix**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Calculate customer lifetime value by combining customer balances, transaction history, and product profitability. Identify high-value customers and their product preferences for targeted marketing.
```

### ✅ **Expected Results:**
- **Customer Value**: Lifetime value calculations combining balance and purchases
- **Product Affinity**: Which high-value customers prefer which products
- **Marketing Insights**: Target products for high-value customer segments
- **Revenue Optimization**: Strategies to increase customer value

---

## 🎯 **Test M10: Business Intelligence Dashboard**

### Steps:
1. Use **ALL THREE** CSV files
2. Enter this prompt:

**🤖 PROMPT:**
```
Create a comprehensive business intelligence dashboard combining all data sources. Include KPIs, performance metrics, customer insights, product analytics, and operational intelligence for executive decision-making.
```

### ✅ **Expected Results:**
- **Executive KPIs**: Total revenue, customer count, product performance
- **Customer Insights**: Segmentation, loyalty, satisfaction indicators
- **Product Analytics**: Profitability, inventory turnover, category performance
- **Operational Metrics**: Sales rep performance, channel effectiveness, regional analysis

---

# 📊 **Multi-File Test Summary**

| Test | Integration Level | Files Used | Expected Records | Key Features |
|------|------------------|------------|------------------|--------------|
| **M1** | Complete Join | All 3 | ~11 | Sales analysis with all data |
| **M2** | Customer-Centric | All 3 | ~12 | Customer transaction history |
| **M3** | Product-Centric | All 3 | ~11 | Product performance analysis |
| **M4** | Rep-Centric | All 3 | ~12 | Sales rep dashboard |
| **M5** | Return Analysis | All 3 | ~1 | Return pattern analysis |
| **M6** | Regional | All 3 | ~12 | Geographic market analysis |
| **M7** | Channel Analysis | All 3 | ~12 | Channel and payment optimization |
| **M8** | Inventory | All 3 | ~11 | Demand-driven inventory |
| **M9** | Customer Value | All 3 | ~10 | Lifetime value analysis |
| **M10** | Executive BI | All 3 | Varies | Comprehensive dashboard |

## 🔗 **Data Relationship Map**

### **Primary Relationships:**
- **Customers ↔ Transactions**: Customer_ID linkage
- **Products ↔ Transactions**: Product_Code linkage  
- **Customers ↔ Products**: Through transactions (indirect)

### **Key Linkage Points:**
- **CUST001** → TXN001 (Laptop), TXN011 (Office Chair Return)
- **CUST002** → TXN002 (Office Chair)
- **CUST003** → TXN003 (Coffee Maker), TXN012 (Printer)
- **CUST004** → TXN004 (Smartphone)

## 🎯 **Expected Integration Results**

### ✅ **Customer-Transaction-Product Matches:**
- **High-Value Electronics**: CUST001 ($15k balance) → Laptop Pro ($1299.99)
- **Furniture Purchase**: CUST002 ($2.5k balance) → Office Chair ($299.50)
- **Appliance Purchase**: CUST003 ($750 balance) → Coffee Maker ($89.99)
- **Premium Mobile**: CUST004 ($25k balance) → Smartphone ($899.00)

### ✅ **Business Intelligence Insights:**
- **Top Customers**: VIP tier customers prefer high-end electronics
- **Category Performance**: Electronics generate highest revenue
- **Channel Preferences**: Online preferred for high-value purchases
- **Regional Patterns**: Different regions show varying product preferences

## 🚨 **Integration Challenges to Watch For:**

### **Data Quality Checks:**
- [ ] All Customer_IDs in transactions exist in customers file
- [ ] All Product_Codes in transactions exist in products file
- [ ] No orphaned records or missing relationships
- [ ] Consistent data types across files

### **Join Accuracy:**
- [ ] Correct customer information matched to transactions
- [ ] Proper product details linked to purchases
- [ ] Accurate financial calculations across files
- [ ] Proper handling of the return transaction (TXN011)

## 🎯 **Testing Priority**
1. **🔥 CRITICAL**: Test M1 (Complete integration) - Validates all joins work
2. **📊 ANALYTICS**: Tests M2, M3 (Core business analysis)
3. **🎯 BUSINESS**: Tests M4, M6, M9 (Strategic insights)
4. **🔍 DEEP DIVE**: Tests M5, M7, M8 (Specific analysis)
5. **📈 EXECUTIVE**: Test M10 (Comprehensive dashboard)

This guide tests the most complex transformation scenarios requiring integration of multiple data sources, providing comprehensive business intelligence and analytics capabilities!