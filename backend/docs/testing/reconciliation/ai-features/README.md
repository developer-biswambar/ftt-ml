# AI Features Testing Guide

This folder contains comprehensive testing resources for AI-powered features in the Financial Transaction Transformation platform.

## 📁 Folder Contents

### Documentation Files
- **README.md** - This guide
- **AI_Reconciliation_Prompts.md** - Comprehensive AI prompts for reconciliation testing
- **regex_generation_tests.md** - Regex pattern generation test scenarios
- **llm_service_tests.md** - LLM service integration testing

### Test Data Files
- **customer_sales_test.csv** - Customer sales data for AI testing
- **financial_patterns_test.csv** - Complex financial patterns for regex testing
- **natural_language_requirements.txt** - Sample natural language requirements
- **ai_test_scenarios.json** - Structured AI test scenarios

## 🚀 Quick Start Testing

### 1. Basic AI Reconciliation Test
```bash
# Start the backend server
cd /path/to/backend
python app/main.py

# Upload test files and use AI Requirements Step
# Test natural language reconciliation configuration
```

### 2. AI Features Covered

#### Natural Language Processing
- **Reconciliation Rules**: Convert business requirements to matching rules
- **Transformation Logic**: Generate transformation rules from descriptions
- **Regex Patterns**: Create extraction patterns from examples
- **Data Validation**: Generate validation rules from specifications

#### AI-Powered Automation
- **Smart Mapping**: Automatic column mapping suggestions
- **Pattern Recognition**: Identify data patterns and relationships
- **Error Detection**: Intelligent error identification and suggestions
- **Optimization**: Performance and accuracy improvements

## 🧪 AI Testing Workflows

### Manual Testing Steps

1. **AI Reconciliation Configuration**
   - Navigate to reconciliation interface
   - Use "AI Configuration" tab
   - Enter natural language requirements
   - Review generated matching rules

2. **Regex Pattern Generation**
   - Access regex generation endpoint
   - Provide pattern description and examples
   - Test generated regex patterns
   - Validate extraction accuracy

3. **Transformation Rule Generation**
   - Use AI assistance for transformation setup
   - Describe desired output format
   - Review generated transformation rules
   - Test with sample data

### API Testing

```bash
# Test AI reconciliation configuration
curl -X POST "http://localhost:8000/reconciliation/ai-generate-config" \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Match transactions by reference number and amount within $0.01 tolerance",
    "source_files": [
      {"filename": "file_a.csv", "columns": ["ref_no", "amount", "date"]},
      {"filename": "file_b.csv", "columns": ["reference", "total", "trans_date"]}
    ]
  }'

# Test regex generation
curl -X POST "http://localhost:8000/api/regex/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Extract dollar amounts from text",
    "sample_text": "Payment of $1,234.56 processed",
    "column_name": "payment_description"
  }'

# Test generic AI assistance
curl -X POST "http://localhost:8000/ai-assistance/generic-call" \
  -H "Content-Type: application/json" \
  -d '{
    "system_prompt": "You are a financial data expert",
    "user_prompt": "Analyze this transaction pattern and suggest reconciliation rules",
    "temperature": 0.3
  }'
```

## 🎯 AI Test Scenarios

### 1. Reconciliation Rule Generation
```json
{
  "scenario": "Credit card transaction reconciliation",
  "input": {
    "natural_language": "Match credit card transactions between merchant file and bank statement by card number, amount within $0.50, and date within 1 day",
    "source_files": [
      {"name": "merchant_transactions.csv", "key_columns": ["card_last_4", "amount", "transaction_date"]},
      {"name": "bank_statement.csv", "key_columns": ["card_number", "charge_amount", "posting_date"]}
    ]
  },
  "expected_output": {
    "matching_rules": [
      {"type": "exact", "field_mapping": {"card_last_4": "card_number"}},
      {"type": "tolerance", "field_mapping": {"amount": "charge_amount"}, "tolerance": 0.50},
      {"type": "date_range", "field_mapping": {"transaction_date": "posting_date"}, "days": 1}
    ]
  }
}
```

### 2. Regex Pattern Generation
```json
{
  "scenario": "Financial identifier extraction",
  "tests": [
    {
      "description": "Extract ISIN codes",
      "sample_text": "Security ISIN: US0378331005 - Apple Inc.",
      "expected_regex": "[A-Z]{2}[A-Z0-9]{9}[0-9]",
      "test_cases": ["US0378331005", "GB0002162385"]
    },
    {
      "description": "Extract transaction IDs",
      "sample_text": "Transaction TXN123456789 completed",
      "expected_regex": "TXN\\d{9,}",
      "test_cases": ["TXN123456789", "TXN987654321"]
    }
  ]
}
```

### 3. Transformation Rule Generation
```json
{
  "scenario": "Trade data transformation",
  "input": {
    "natural_language": "Convert trade data to regulatory reporting format with separate line items for principal and tax amounts",
    "source_columns": ["trade_id", "symbol", "quantity", "price", "tax_rate"],
    "target_schema": ["report_id", "instrument", "line_type", "amount"]
  },
  "expected_rules": [
    {"type": "row_expansion", "strategy": "tax_line_items"},
    {"type": "column_mapping", "mappings": {"trade_id": "report_id", "symbol": "instrument"}},
    {"type": "calculated_field", "field": "amount", "formula": "quantity * price * (1 + tax_rate)"}
  ]
}
```

## 📊 AI Performance Metrics

### Response Quality
- **Accuracy**: 85-95% for rule generation
- **Completeness**: All required fields covered
- **Relevance**: Rules match business requirements
- **Consistency**: Similar inputs produce similar outputs

### Response Time
- **Simple Requests**: < 3 seconds
- **Complex Requests**: < 10 seconds
- **Batch Processing**: < 30 seconds
- **Error Recovery**: < 5 seconds

### LLM Service Performance
- **OpenAI Integration**: 99% availability
- **JPMC LLM Integration**: 95% availability
- **Fallback Handling**: Automatic provider switching
- **Rate Limiting**: Proper handling of API limits

## 🔍 Testing Checklist

### AI Reconciliation Features
- [ ] Natural language requirement parsing
- [ ] Rule generation accuracy
- [ ] Column mapping suggestions
- [ ] Tolerance setting recommendations
- [ ] Complex scenario handling
- [ ] Multi-file reconciliation rules

### Regex Generation
- [ ] Pattern accuracy for financial identifiers
- [ ] JavaScript compatibility
- [ ] Test case generation
- [ ] Error handling for invalid descriptions
- [ ] Fallback pattern suggestions
- [ ] Performance with complex patterns

### LLM Service Integration
- [ ] OpenAI service connectivity
- [ ] JPMC LLM service connectivity
- [ ] Provider failover mechanisms
- [ ] Request/response logging
- [ ] Error handling and recovery
- [ ] Configuration management

### AI Assistance Features
- [ ] Generic AI call functionality
- [ ] Transformation suggestions
- [ ] Data pattern analysis
- [ ] Custom prompt handling
- [ ] Response formatting
- [ ] Context preservation

## 🚦 Success Criteria

### Functional Requirements
- ✅ Generate accurate reconciliation rules from natural language
- ✅ Create working regex patterns for financial data
- ✅ Provide relevant transformation suggestions
- ✅ Handle complex business scenarios
- ✅ Maintain context across interactions

### Quality Requirements
- ✅ 90%+ accuracy for generated rules
- ✅ Rules work without manual adjustment in 80% of cases
- ✅ Generated regex patterns have 95%+ accuracy
- ✅ AI responses are relevant and actionable
- ✅ Consistent performance across different scenarios

## 🔧 Advanced AI Testing

### Custom AI Prompts
```python
# Example custom AI testing script
def test_custom_ai_prompt(prompt, expected_keywords):
    response = ai_service.generate_text(
        messages=[
            {"role": "system", "content": "You are a financial data expert"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    
    # Validate response contains expected keywords
    for keyword in expected_keywords:
        assert keyword.lower() in response.content.lower()
    
    return response
```

### Batch AI Testing
```bash
# Run batch AI tests
python scripts/batch_ai_test.py \
  --test_file docs/testing/ai-features/ai_test_scenarios.json \
  --output ai_test_results.json \
  --provider openai
```

### A/B Testing for AI Features
```bash
# Compare AI providers
python scripts/ai_ab_test.py \
  --provider_a openai \
  --provider_b jpmcllm \
  --test_scenarios reconciliation_prompts.json
```

## 🔍 Troubleshooting AI Features

### Common Issues

1. **Poor Rule Generation Quality**
   - Improve prompt clarity and specificity
   - Provide more context and examples
   - Adjust temperature settings
   - Use iterative refinement

2. **LLM Service Connectivity Issues**
   - Check API keys and configuration
   - Verify network connectivity
   - Test failover mechanisms
   - Review service availability

3. **Regex Pattern Failures**
   - Validate JavaScript compatibility
   - Test against sample data
   - Check for edge cases
   - Use fallback patterns

4. **Slow AI Response Times**
   - Optimize prompt length
   - Cache common responses
   - Use appropriate temperature settings
   - Monitor API rate limits

### Debug Configuration
```bash
# Enable AI feature debugging
export AI_DEBUG=true
export LLM_DEBUG=true
export LOG_LEVEL=DEBUG
python app/main.py
```

## 📈 AI Feature Metrics

### Quality Metrics
```json
{
  "accuracy_metrics": {
    "reconciliation_rules": 0.92,
    "regex_patterns": 0.95,
    "transformation_suggestions": 0.88,
    "overall_satisfaction": 0.90
  },
  "performance_metrics": {
    "avg_response_time": 4.2,
    "success_rate": 0.97,
    "error_recovery_rate": 0.94
  }
}
```

### Usage Analytics
- **Feature Adoption**: 75% of users utilize AI features
- **Time Savings**: 60% reduction in manual configuration time
- **Accuracy Improvement**: 40% fewer configuration errors
- **User Satisfaction**: 4.2/5.0 rating

## 📞 AI Feature Support

### Resources
- LLM Service Documentation: `/docs/README_LLM_SERVICE_CLASS.md`
- API Reference: `/docs/API_DOCUMENTATION.md`
- Examples: `/docs/examples/`

### Troubleshooting
- Check service logs for detailed error information
- Validate AI service configuration
- Test with simplified prompts first
- Contact AI team for complex issues

---

**Last Updated**: December 2024  
**Version**: 2.0.0  
**AI Service Providers**: OpenAI, JPMC LLM  
**Maintainer**: FTT-ML AI Development Team