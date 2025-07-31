# Financial Data Transformation Platform (FTT-ML)

A comprehensive platform for financial data processing, reconciliation, and AI-powered transformation.

## 🏗️ Architecture

- **Backend**: FastAPI (Python) - High-performance API with async support
- **Frontend**: React 19 + Vite - Modern React application
- **AI Integration**: Pluggable LLM providers (OpenAI, Anthropic, Gemini)
- **Storage**: Local/S3 with pluggable storage backends

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure your environment
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Configuration
```bash
# Required: OpenAI API Key
export OPENAI_API_KEY="your-openai-api-key"

# Optional: Switch LLM providers
export LLM_PROVIDER="openai"  # or "anthropic", "gemini"
export LLM_MODEL="gpt-3.5-turbo"
```

## 📋 Features

### Core Features
- ✅ **File Processing** - CSV, Excel upload and processing
- ✅ **Data Reconciliation** - Match financial transactions between sources
- ✅ **Data Transformation** - AI-powered data transformation with expressions
- ✅ **Delta Generation** - Compare file versions to identify changes
- ✅ **AI Integration** - Pluggable LLM providers for intelligent processing

### AI-Powered Features
- ✅ **Smart Configuration Generation** - AI generates transformation rules
- ✅ **Expression Evaluation** - Mathematical and string expressions
- ✅ **Dynamic Conditions** - Complex conditional logic
- ✅ **Regex Generation** - AI-powered pattern generation

### Technical Features
- ✅ **High Performance** - Optimized for 50k-100k record datasets
- ✅ **Pluggable Architecture** - Swap LLM providers without code changes
- ✅ **Health Monitoring** - Built-in health checks and monitoring
- ✅ **Comprehensive Testing** - Full test coverage with custom test runner

## 📖 Documentation

- [Development Guide](./CLAUDE.md) - Comprehensive development instructions
- [LLM Service Guide](./backend/app/services/README_LLM.md) - AI provider setup
- [API Documentation](./backend/docs/) - Postman collections and API docs
- [Test Scenarios](./backend/sample_data/reconciliation_test_scenarios.md) - Test data and scenarios

## 🧪 Testing

### Backend Tests
```bash
cd backend
python test/run_tests.py --coverage          # All tests with coverage
python test/run_tests.py -m file_upload      # File upload tests only
python test/run_tests.py --parallel          # Parallel execution
```

### Sample Data
The `backend/sample_data/` directory contains comprehensive test datasets for:
- Reconciliation testing (recon_file_a.csv, recon_file_b.csv)
- Delta comparison (delta_fileA_old.csv, delta_fileB_new.csv)
- Transformation examples (customer_sales_test.csv)

## 🔧 Configuration

### Environment Variables
See `.env` files for complete configuration options:
- **LLM Settings**: API keys, models, temperature
- **Performance**: Batch sizes, memory limits, file size limits
- **Storage**: Local vs S3 configuration
- **Logging**: Debug levels and output formats

### Health Checks
- **API Health**: `GET /health`
- **Transformation Health**: `GET /transformation/health`
- **LLM Provider Status**: Included in health responses

## 🏢 Production Deployment

### Security
- Change default secret keys
- Use environment variables for sensitive data
- Configure CORS for specific domains
- Set up proper logging and monitoring

### Performance
- Configured for large datasets (50k-100k records)
- Optimized memory usage and batch processing
- Supports horizontal scaling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `python test/run_tests.py`
4. Submit a pull request

## 📄 License

[Add your license here]

## 🆘 Support

- Check the [troubleshooting guide](./CLAUDE.md#troubleshooting)
- Review [test scenarios](./backend/sample_data/reconciliation_test_scenarios.md)
- File issues in the repository

---

**Built with ❤️ for financial data processing**