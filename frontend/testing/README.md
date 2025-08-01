# 🎯 FTT-ML UI Testing Suite

## Overview
Comprehensive testing strategy covering all UI scenarios with maximum speed and coverage.

## 🚀 Quick Start (5 minutes to test everything)

### 1. Prerequisites
```bash
# Ensure backend is running
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ensure frontend is running  
cd frontend
npm run dev
```

### 2. Run All Tests (Fastest)
```bash
# Single command - tests everything
npm run test:ui:all

# Or manually
node testing/test-runner.js all
```

### 3. Quick Smoke Test (30 seconds)
```bash
# Just verify core functionality works
node testing/test-runner.js smoke
```

## 📋 Testing Levels

### 🚀 **Level 1: Smoke Tests** (30 seconds)
**What**: Quick verification that app loads and core navigation works
**Run**: `node testing/test-runner.js smoke`
**Coverage**: 
- App loads without errors
- All main tabs accessible
- File upload UI functional
- AI assistance buttons visible

### 🔄 **Level 2: Workflow Tests** (5-10 minutes)
**What**: Complete end-to-end workflows for all features
**Run**: `node testing/test-runner.js workflows`
**Coverage**:
- Complete reconciliation workflow
- Complete transformation workflow  
- Complete delta generation workflow
- Data viewer integration
- AI assistance integration
- Error handling scenarios

### ⚡ **Level 3: Performance Tests** (2-3 minutes)
**What**: Load times, large file handling, responsiveness
**Run**: `node testing/test-runner.js performance`
**Coverage**:
- Page load performance
- Large dataset processing
- Memory usage
- API response times

### 📱 **Level 4: Mobile Tests** (2-3 minutes)
**What**: Mobile responsiveness and touch interactions
**Run**: `node testing/test-runner.js mobile`
**Coverage**:
- Different viewport sizes
- Touch interactions
- Mobile navigation
- Responsive layouts

## 🎯 **Best Testing Strategy by Time Available**

### ⚡ **5 Minutes Available**
```bash
# Run smoke tests + one full workflow
node testing/test-runner.js smoke
npx playwright test testing/e2e/complete-workflow.spec.js --grep "Complete Reconciliation Workflow"
```

### ⏱️ **15 Minutes Available**
```bash
# Run comprehensive suite
node testing/test-runner.js all
```

### 🏃 **30 Minutes Available**
```bash
# Run all tests + manual exploratory testing
node testing/test-runner.js all
# Then manually test edge cases and new features
```

## 📁 Test Structure

```
testing/
├── e2e/
│   ├── smoke-tests.spec.js          # Quick core verification
│   ├── complete-workflow.spec.js    # Full workflow testing
│   └── edge-cases.spec.js           # Error scenarios & edge cases
├── utils/
│   └── test-data-setup.js           # Test data utilities
├── fixtures/                        # Test data files
├── reports/                         # Test reports
└── test-runner.js                   # Main test orchestrator
```

## 🎪 **Test Scenarios Covered**

### **Reconciliation Testing**
- ✅ File upload (single & multiple)
- ✅ AI configuration generation
- ✅ Manual configuration setup
- ✅ Rule validation
- ✅ Processing with different data types
- ✅ Results viewing and downloading
- ✅ Error handling (invalid files, network errors)

### **Transformation Testing**
- ✅ Multi-file source setup
- ✅ Rule builder interface
- ✅ Column mapping (direct, static, dynamic)
- ✅ Row generation and expansion
- ✅ Preview functionality
- ✅ Complex multi-rule scenarios
- ✅ Validation and error states

### **Delta Generation Testing**
- ✅ File comparison setup
- ✅ Key column selection
- ✅ Delta categorization
- ✅ Results visualization
- ✅ Export functionality

### **Data Viewer Testing**
- ✅ File navigation
- ✅ Data filtering and sorting
- ✅ Pagination
- ✅ Export options
- ✅ Large dataset handling

### **AI Integration Testing**
- ✅ AI configuration generation
- ✅ Regex pattern generation
- ✅ Mapping suggestions
- ✅ Error handling for AI failures
- ✅ Response parsing and validation

### **Cross-Cutting Concerns**
- ✅ Mobile responsiveness
- ✅ Performance with large files
- ✅ Error states and recovery
- ✅ Loading states and feedback
- ✅ Accessibility basics
- ✅ Security (XSS prevention, file validation)

## 🛠️ **Custom Test Commands**

```bash
# Quick verification
npm run test:smoke

# Full workflow testing
npm run test:workflows

# Performance testing only
npm run test:performance

# Mobile testing only
npm run test:mobile

# Test specific feature
npx playwright test --grep "reconciliation"
npx playwright test --grep "transformation"
npx playwright test --grep "delta"

# Debug mode (see browser)
npx playwright test --headed --debug

# Generate test report
npm run test:report
```

## 📊 **Test Reports**

After running tests, check:
- `testing/reports/ui-test-report.json` - Detailed JSON report
- `testing/reports/test-results.html` - Visual HTML report
- `testing/screenshots/` - Screenshots of failures

## 🔧 **Test Data**

All test data is automatically set up in `testing/fixtures/`:
- Reconciliation test files
- Transformation source files  
- Delta comparison files
- Large files for performance testing
- Invalid files for error testing

## 🚨 **Troubleshooting**

### Common Issues:

**Backend not running:**
```bash
cd backend && python -m uvicorn app.main:app --reload
```

**Frontend not running:**
```bash
cd frontend && npm run dev
```

**Test files missing:**
```bash
# Files are auto-created, but you can manually copy:
cp ../backend/docs/testing/reconciliation/*.csv testing/fixtures/
```

**Browser issues:**
```bash
# Install/update browsers
npx playwright install
```

**Slow tests:**
```bash
# Run specific tests only
npx playwright test testing/e2e/smoke-tests.spec.js
```

## 🎯 **Optimization Tips**

### **For Speed:**
1. Run smoke tests first - fails fast if major issues
2. Use `--grep` to test specific features
3. Run tests in parallel: `--workers=4`
4. Skip mobile tests during development: `--grep "Mobile" --invert`

### **For Coverage:**
1. Run full suite: `node testing/test-runner.js all`
2. Check test report for gaps
3. Add custom test cases for your specific scenarios
4. Use manual exploratory testing for edge cases

### **For CI/CD:**
1. Use `--reporter=json` for machine-readable results
2. Set appropriate timeouts for CI environment
3. Use headless mode: `--headed=false`
4. Store test artifacts and screenshots

## 🏆 **Success Criteria**

### **Green Light (Ready for Production):**
- ✅ All smoke tests pass
- ✅ Core workflows complete successfully  
- ✅ Performance under acceptable limits
- ✅ Mobile responsiveness working
- ✅ Error handling graceful

### **Yellow Light (Needs Attention):**
- ⚠️ Some performance issues
- ⚠️ Minor mobile responsiveness issues
- ⚠️ Non-critical workflow failures

### **Red Light (Not Ready):**
- ❌ Smoke tests failing
- ❌ Core workflows broken
- ❌ Major performance problems
- ❌ Security vulnerabilities

## 🎪 **Advanced Testing**

For more thorough testing, consider:
- Load testing with multiple concurrent users
- Cross-browser testing (Chrome, Firefox, Safari)
- Accessibility testing with screen readers
- Visual regression testing
- API contract testing
- Database state verification

---

**🚀 Start with: `node testing/test-runner.js all`**

This will give you comprehensive coverage of all UI scenarios in the fastest possible time!