# Frontend Testing Framework

This directory contains a comprehensive testing framework for the Financial Transaction Transformation (FTT-ML) frontend application.

## 📁 Testing Structure

```
testing/
├── README.md                     # This guide
├── e2e/                         # End-to-end tests with Playwright
│   ├── reconciliation.spec.js   # Reconciliation workflow tests
│   ├── transformation.spec.js   # Transformation workflow tests
│   ├── file-upload.spec.js      # File upload and management tests
│   └── delta.spec.js            # Delta generation tests (to be added)
├── integration/                 # API integration tests
│   ├── api-services.test.js     # API service integration tests
│   └── workflow-integration.test.js  # Cross-feature integration tests
├── fixtures/                   # Test data and mock files
│   ├── sample-files/           # Sample CSV/Excel files for testing
│   ├── mock-responses/         # Mock API responses
│   └── test-scenarios/         # Test scenario configurations
├── mocks/                      # Mock Service Worker setup
│   ├── server.js              # MSW server configuration
│   └── handlers.js            # API request handlers
├── reports/                    # Test reports and artifacts
└── utils/                      # Testing utilities and helpers
```

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers (first time only)
npx playwright install
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test reconciliation.spec.js

# Run integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run visual regression tests
npm run test:visual
```

## 🧪 Testing Types

### 1. End-to-End Tests (E2E)
**Location**: `testing/e2e/`
**Framework**: Playwright

**Coverage**:
- ✅ Complete user workflows from start to finish
- ✅ Multi-browser testing (Chrome, Firefox, Safari)
- ✅ Mobile viewport testing
- ✅ Visual regression testing
- ✅ Performance testing

**Key Test Files**:
- `reconciliation.spec.js` - Full reconciliation workflow testing
- `transformation.spec.js` - Data transformation workflow testing
- `file-upload.spec.js` - File upload and management testing

### 2. Integration Tests
**Location**: `testing/integration/`  
**Framework**: Vitest + MSW

**Coverage**:
- ✅ API service integration
- ✅ Cross-component interactions
- ✅ Error handling and recovery
- ✅ Data flow validation

## 📊 Test Scenarios

### Reconciliation Workflow Testing
```javascript
// Example: Full reconciliation workflow
test('should complete full reconciliation workflow', async ({ page }) => {
  // 1. Upload files
  // 2. Configure AI matching rules
  // 3. Execute reconciliation
  // 4. Verify results
  // 5. Export data
})
```

**Scenarios Covered**:
- ✅ File upload and validation
- ✅ AI configuration generation
- ✅ Manual rule configuration
- ✅ Reconciliation execution
- ✅ Results validation and export
- ✅ Error handling and recovery

### Transformation Workflow Testing
```javascript
// Example: AI-powered transformation
test('should generate transformation rules with AI', async ({ page }) => {
  // 1. Upload source data
  // 2. Define output schema
  // 3. Use AI to generate rules
  // 4. Execute transformation
  // 5. Validate results
})
```

**Scenarios Covered**:
- ✅ Data upload and schema detection
- ✅ AI rule generation
- ✅ Manual column mapping
- ✅ Row generation rules
- ✅ Transformation execution
- ✅ Result validation and export

### File Management Testing
**Scenarios Covered**:
- ✅ Single and multiple file uploads
- ✅ File format validation (CSV, Excel)
- ✅ Large file processing
- ✅ File library management
- ✅ Error handling for invalid files

## 🎯 Test Data Management

### Sample Files
Located in `testing/fixtures/sample-files/`:

- **test_data.csv** - Basic test data (5 rows)
- **recon_file_a.csv** - Reconciliation source file
- **recon_file_b.csv** - Reconciliation target file  
- **customer_sales_test.csv** - Customer sales data for transformation
- **large_test_data.csv** - Large dataset for performance testing

### Mock API Responses
Located in `testing/mocks/handlers.js`:

- ✅ Health check responses
- ✅ File upload responses
- ✅ Reconciliation API responses
- ✅ Transformation API responses  
- ✅ Error scenarios

## 📈 Performance Testing

### E2E Performance Tests
```javascript
test('should handle large file reconciliation within time limit', async ({ page }) => {
  const startTime = Date.now();
  // Execute reconciliation workflow
  const endTime = Date.now();
  expect(processingTime).toBeLessThan(120); // 2 minutes max
});
```

**Performance Benchmarks**:
- ✅ File upload: < 30 seconds for 100MB files
- ✅ Reconciliation: < 2 minutes for 50K records
- ✅ Transformation: < 1 minute for 10K records
- ✅ Page load: < 3 seconds initial load

## 🎨 Visual Regression Testing

### Visual Tests
Tagged with `@visual` for easy filtering:

```javascript
test('@visual should match reconciliation page screenshot', async ({ page }) => {
  await page.goto('/reconciliation');
  await expect(page).toHaveScreenshot('reconciliation-page.png');
});
```

**Visual Coverage**:
- ✅ Main application pages
- ✅ Modal dialogs
- ✅ Form states (empty, filled, error)
- ✅ Data tables and previews
- ✅ Mobile responsive layouts

## 🔧 Configuration Files

### Playwright Configuration (`playwright.config.js`)
```javascript
export default defineConfig({
  testDir: './testing/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium' },
    { name: 'firefox' },
    { name: 'webkit' },
    { name: 'Mobile Chrome' },
    { name: 'Mobile Safari' },
  ],
})
```

### Vitest Configuration (`vitest.config.js`)
```javascript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./testing/setup.js'],
    include: ['testing/integration/**/*.{test,spec}.{js,jsx}'],
  },
})
```

## 🚦 Test Commands Reference

### Development Workflow
```bash
# Run tests during development
npm run test:integration:watch    # Watch integration tests
npm run test:e2e:debug           # Debug E2E tests
npm run test:e2e:ui              # Run E2E with UI

# Before committing
npm run test:integration         # Run all integration tests
npm run test:e2e                 # Run all E2E tests
npm run test:visual              # Run visual regression tests
```

### CI/CD Pipeline
```bash
# Continuous Integration
npm run test:integration         # Fast integration tests
npm run test:e2e -- --workers=1 # E2E tests with limited workers
npm run test:visual              # Visual regression validation
```

## 📊 Test Reporting

### HTML Reports
- **Playwright**: `playwright-report/index.html`
- **Vitest**: Console output with detailed error information

### Test Artifacts
- **Screenshots**: Saved on test failures
- **Videos**: Recorded for failed E2E tests
- **Traces**: Detailed execution traces for debugging

## 🔍 Debugging Tests

### Playwright Debugging
```bash
# Run in debug mode
npm run test:e2e:debug

# Run specific test in debug mode
npx playwright test reconciliation.spec.js --debug

# View test traces
npx playwright show-trace trace.zip
```

### Integration Test Debugging
```bash
# Run with detailed output
npm run test:integration -- --reporter=verbose

# Run specific test file
npx vitest api-services.test.js
```

## 📋 Testing Checklist

### Before Release
- [ ] All E2E tests pass across browsers
- [ ] Integration tests pass
- [ ] Visual regression tests pass
- [ ] Performance benchmarks met
- [ ] Error scenarios handled
- [ ] Mobile responsiveness validated

### Test Coverage Goals
- [ ] **E2E Coverage**: All major user workflows
- [ ] **Integration Coverage**: All API endpoints
- [ ] **Error Coverage**: All error scenarios
- [ ] **Performance Coverage**: All critical operations
- [ ] **Visual Coverage**: Key UI components

## 🔧 Troubleshooting

### Common Issues

1. **Playwright Browser Installation**
   ```bash
   npx playwright install
   ```

2. **Test Timeouts**
   - Increase timeout in test configuration
   - Check for slow API responses
   - Verify mock service responses

3. **Visual Test Failures**
   - Update baseline screenshots: `npx playwright test --update-snapshots`
   - Check for browser differences
   - Verify consistent test data

4. **Integration Test Failures**
   - Check MSW handler configurations
   - Verify API endpoint mocks
   - Check network connectivity

### Debug Commands
```bash
# Check test configuration
npx playwright --version
npx vitest --version

# Validate test files
npx playwright test --list
npx vitest --run --reporter=verbose
```

## 📞 Support and Resources

### Documentation
- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library](https://testing-library.com/)

### Internal Resources
- Backend API Documentation: `../backend/docs/API_DOCUMENTATION.md`
- Sample Data: `../backend/docs/testing/`
- Component Documentation: `../src/components/`

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Testing Framework**: Playwright + Vitest + MSW  
**Maintainer**: FTT-ML Frontend Team

## 🚀 Getting Started Checklist

For new team members:

1. **Setup Environment**
   - [ ] Install Node.js dependencies: `npm install`
   - [ ] Install Playwright browsers: `npx playwright install`
   - [ ] Verify backend is running on `http://localhost:8000`

2. **Run Initial Tests**
   - [ ] Run integration tests: `npm run test:integration`
   - [ ] Run a simple E2E test: `npx playwright test file-upload.spec.js`
   - [ ] Check visual tests: `npm run test:visual`

3. **Explore Test Structure**
   - [ ] Review test files in `testing/e2e/`
   - [ ] Check mock configurations in `testing/mocks/`
   - [ ] Examine sample data in `testing/fixtures/`

4. **Start Contributing**
   - [ ] Add test scenarios for new features
   - [ ] Update mock handlers for new API endpoints
   - [ ] Maintain visual regression baselines
   - [ ] Document new testing patterns