// Complete UI Workflow Testing - Covers all major scenarios
import { test, expect } from '@playwright/test';

test.describe('Complete FTT-ML Workflow Tests', () => {
  
  // Test data files - these should be placed in testing/fixtures/
  const testFiles = {
    reconciliation: {
      fileA: 'testing/fixtures/recon_file_a.csv',
      fileB: 'testing/fixtures/recon_file_b.csv'
    },
    transformation: {
      customers: 'testing/fixtures/source_customer_data.csv',
      transactions: 'testing/fixtures/source_transaction_data.csv',
      products: 'testing/fixtures/source_product_data.csv'
    },
    delta: {
      oldFile: 'testing/fixtures/delta_file_old.csv',
      newFile: 'testing/fixtures/delta_file_new.csv'
    }
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await expect(page.locator('[data-testid="app-loaded"]')).toBeVisible({ timeout: 10000 });
  });

  test('🔄 Complete Reconciliation Workflow', async ({ page }) => {
    // Navigate to reconciliation
    await page.click('[data-testid="reconciliation-tab"]');
    await expect(page.locator('h2:has-text("Reconciliation")')).toBeVisible();

    // Upload files
    await page.click('[data-testid="upload-files-btn"]');
    
    // Upload File A
    const fileInputA = page.locator('input[type="file"]').first();
    await fileInputA.setInputFiles(testFiles.reconciliation.fileA);
    await expect(page.locator('[data-testid="file-a-uploaded"]')).toBeVisible();

    // Upload File B  
    const fileInputB = page.locator('input[type="file"]').last();
    await fileInputB.setInputFiles(testFiles.reconciliation.fileB);
    await expect(page.locator('[data-testid="file-b-uploaded"]')).toBeVisible();

    // Generate AI configuration
    await page.click('[data-testid="ai-generate-config"]');
    await page.fill('[data-testid="requirements-input"]', 
      'Match transactions by reference number and amount with 0.01 tolerance');
    await page.click('[data-testid="generate-config-btn"]');
    
    // Wait for AI response
    await expect(page.locator('[data-testid="config-generated"]')).toBeVisible({ timeout: 30000 });

    // Run reconciliation
    await page.click('[data-testid="run-reconciliation"]');
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    
    // Wait for results
    await expect(page.locator('[data-testid="reconciliation-results"]')).toBeVisible({ timeout: 60000 });
    
    // Verify results
    const matchedCount = await page.locator('[data-testid="matched-count"]').textContent();
    expect(parseInt(matchedCount)).toBeGreaterThan(0);

    // Download results
    await page.click('[data-testid="download-results"]');
    // Verify download initiated (file dialog appears)
  });

  test('🔄 Complete Transformation Workflow', async ({ page }) => {
    // Navigate to transformation
    await page.click('[data-testid="transformation-tab"]');
    await expect(page.locator('h2:has-text("Transformation")')).toBeVisible();

    // Upload multiple source files
    await page.click('[data-testid="add-source-file"]');
    const customerFile = page.locator('input[type="file"]').first();
    await customerFile.setInputFiles(testFiles.transformation.customers);

    await page.click('[data-testid="add-source-file"]');
    const transactionFile = page.locator('input[type="file"]').last();
    await transactionFile.setInputFiles(testFiles.transformation.transactions);

    // Create transformation rules
    await page.click('[data-testid="add-transformation-rule"]');
    await page.fill('[data-testid="rule-name"]', 'Customer Enrichment');
    
    // Add output columns
    await page.click('[data-testid="add-output-column"]');
    await page.fill('[data-testid="column-name"]', 'customer_tier');
    await page.selectOption('[data-testid="mapping-type"]', 'dynamic');
    
    // Add dynamic conditions
    await page.click('[data-testid="add-condition"]');
    await page.fill('[data-testid="condition-column"]', 'Balance');
    await page.selectOption('[data-testid="condition-operator"]', '>=');
    await page.fill('[data-testid="condition-value"]', '15000');
    await page.fill('[data-testid="output-value"]', 'VIP');

    // Preview transformation
    await page.click('[data-testid="preview-transformation"]');
    await expect(page.locator('[data-testid="preview-results"]')).toBeVisible({ timeout: 30000 });

    // Run full transformation
    await page.click('[data-testid="run-transformation"]');
    await expect(page.locator('[data-testid="transformation-complete"]')).toBeVisible({ timeout: 60000 });

    // Verify output
    const outputRows = await page.locator('[data-testid="output-row-count"]').textContent();
    expect(parseInt(outputRows)).toBeGreaterThan(0);
  });

  test('🔄 Complete Delta Generation Workflow', async ({ page }) => {
    // Navigate to delta generation
    await page.click('[data-testid="delta-tab"]');
    await expect(page.locator('h2:has-text("Delta Generation")')).toBeVisible();

    // Upload old and new files
    await page.click('[data-testid="upload-old-file"]');
    const oldFile = page.locator('input[type="file"]').first();
    await oldFile.setInputFiles(testFiles.delta.oldFile);

    await page.click('[data-testid="upload-new-file"]');
    const newFile = page.locator('input[type="file"]').last();
    await newFile.setInputFiles(testFiles.delta.newFile);

    // Configure delta settings
    await page.click('[data-testid="select-key-columns"]');
    await page.check('[data-testid="key-column-id"]');
    await page.check('[data-testid="key-column-reference"]');

    // Generate delta
    await page.click('[data-testid="generate-delta"]');
    await expect(page.locator('[data-testid="delta-results"]')).toBeVisible({ timeout: 30000 });

    // Verify delta categories
    await expect(page.locator('[data-testid="unchanged-records"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-records"]')).toBeVisible();
    await expect(page.locator('[data-testid="modified-records"]')).toBeVisible();
    await expect(page.locator('[data-testid="deleted-records"]')).toBeVisible();
  });

  test('📊 Data Viewer Integration', async ({ page }) => {
    // Test viewer from different entry points
    await page.click('[data-testid="file-library"]');
    await expect(page.locator('[data-testid="file-list"]')).toBeVisible();

    // Click on a processed file
    await page.click('[data-testid="view-file-data"]');
    await expect(page.locator('[data-testid="data-viewer"]')).toBeVisible();

    // Test viewer features
    await page.click('[data-testid="filter-data"]');
    await page.fill('[data-testid="filter-input"]', 'Active');
    await page.click('[data-testid="apply-filter"]');

    // Test pagination
    await page.click('[data-testid="next-page"]');
    await expect(page.locator('[data-testid="page-2"]')).toBeVisible();

    // Test export
    await page.click('[data-testid="export-data"]');
    await page.click('[data-testid="export-csv"]');
  });

  test('🤖 AI Integration Testing', async ({ page }) => {
    // Test AI assistance across different modules
    
    // Reconciliation AI
    await page.click('[data-testid="reconciliation-tab"]');
    await page.click('[data-testid="ai-assistance"]');
    await page.fill('[data-testid="ai-prompt"]', 
      'Create reconciliation rules for bank statement matching');
    await page.click('[data-testid="generate-ai-rules"]');
    await expect(page.locator('[data-testid="ai-suggestions"]')).toBeVisible({ timeout: 30000 });

    // Transformation AI
    await page.click('[data-testid="transformation-tab"]');
    await page.click('[data-testid="ai-mapping-suggestions"]');
    await expect(page.locator('[data-testid="suggested-mappings"]')).toBeVisible({ timeout: 30000 });

    // Regex AI Generator
    await page.click('[data-testid="ai-regex-generator"]');
    await page.fill('[data-testid="sample-text"]', 'Extract amount from: $1,234.56');
    await page.click('[data-testid="generate-regex"]');
    await expect(page.locator('[data-testid="generated-regex"]')).toBeVisible({ timeout: 20000 });
  });

  test('🔧 Error Handling & Edge Cases', async ({ page }) => {
    // Test error scenarios
    
    // Upload invalid file
    await page.click('[data-testid="reconciliation-tab"]');
    await page.click('[data-testid="upload-files-btn"]');
    
    // Try uploading non-CSV file
    await page.setInputFiles('input[type="file"]', 'testing/fixtures/invalid.txt');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid file format');

    // Test network error handling
    await page.route('**/api/**', route => route.abort());
    await page.click('[data-testid="run-process"]');
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();

    // Test large file handling
    await page.unroute('**/api/**');
    // Upload large file and verify progress indicator
    await page.setInputFiles('input[type="file"]', 'testing/fixtures/large_file.csv');
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
  });

  test('📱 Mobile Responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test mobile navigation
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Test mobile workflows
    await page.click('[data-testid="reconciliation-tab"]');
    await expect(page.locator('[data-testid="mobile-reconciliation-view"]')).toBeVisible();

    // Test touch interactions
    await page.tap('[data-testid="upload-area"]');
    await expect(page.locator('[data-testid="file-picker"]')).toBeVisible();
  });

  test('⚡ Performance Testing', async ({ page }) => {
    // Monitor performance metrics
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart
      };
    });

    expect(performanceMetrics.loadTime).toBeLessThan(5000); // 5 seconds max
    expect(performanceMetrics.domContentLoaded).toBeLessThan(3000); // 3 seconds max

    // Test large dataset handling
    await page.click('[data-testid="upload-large-dataset"]');
    const startTime = Date.now();
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 60000 });
    const processingTime = Date.now() - startTime;
    
    expect(processingTime).toBeLessThan(30000); // 30 seconds max for large datasets
  });

  test('🔐 Security & Validation', async ({ page }) => {
    // Test input validation
    await page.click('[data-testid="transformation-tab"]');
    await page.fill('[data-testid="rule-name"]', '<script>alert("xss")</script>');
    await page.click('[data-testid="save-rule"]');
    
    // Should not execute script, should escape HTML
    await expect(page.locator('[data-testid="rule-display"]')).not.toContainText('<script>');

    // Test file upload security
    await page.setInputFiles('input[type="file"]', 'testing/fixtures/malicious.exe');
    await expect(page.locator('[data-testid="security-error"]')).toContainText('File type not allowed');

    // Test data privacy
    await page.fill('[data-testid="sensitive-data-input"]', 'SSN: 123-45-6789');
    await expect(page.locator('[data-testid="privacy-warning"]')).toBeVisible();
  });
});