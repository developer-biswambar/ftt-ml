import { test, expect } from '@playwright/test';

test.describe('Reconciliation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete full reconciliation workflow', async ({ page }) => {
    // Navigate to reconciliation
    await page.click('[data-testid="reconciliation-tab"]');
    await expect(page.locator('h2')).toContainText('Financial Data Reconciliation');

    // Upload first file
    await page.locator('input[type="file"]').first().setInputFiles('testing/fixtures/sample-files/recon_file_a.csv');
    await page.fill('[data-testid="file-label-input"]', 'File A');
    await page.click('[data-testid="upload-button"]');
    
    // Wait for upload success
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();

    // Upload second file
    await page.locator('input[type="file"]').nth(1).setInputFiles('testing/fixtures/sample-files/recon_file_b.csv');
    await page.fill('[data-testid="file-label-input"]', 'File B');
    await page.click('[data-testid="upload-button"]');
    
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();

    // Configure reconciliation using AI
    await page.click('[data-testid="ai-configuration-tab"]');
    await page.fill('[data-testid="ai-requirements-input"]', 
      'Match transactions by reference number and amount within $0.01 tolerance');
    
    await page.click('[data-testid="generate-ai-config"]');
    
    // Wait for AI configuration to complete
    await expect(page.locator('[data-testid="ai-config-success"]')).toBeVisible({ timeout: 10000 });

    // Execute reconciliation
    await page.click('[data-testid="execute-reconciliation"]');
    
    // Wait for reconciliation results
    await expect(page.locator('[data-testid="reconciliation-results"]')).toBeVisible({ timeout: 30000 });
    
    // Verify results are displayed
    await expect(page.locator('[data-testid="matched-count"]')).toContainText('85');
    await expect(page.locator('[data-testid="match-rate"]')).toContainText('85%');
    
    // Export results
    await page.click('[data-testid="export-results"]');
    await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
  });

  test('should handle AI configuration with different requirements', async ({ page }) => {
    // Navigate to reconciliation
    await page.click('[data-testid="reconciliation-tab"]');
    
    // Skip file upload for this test (assuming files are already uploaded)
    await page.click('[data-testid="ai-configuration-tab"]');
    
    // Test different AI prompts
    const aiPrompts = [
      'Match by transaction ID exactly',
      'Match by amount within 1% tolerance and date within 3 days',
      'Fuzzy match by customer name and approximate amount'
    ];
    
    for (const prompt of aiPrompts) {
      await page.fill('[data-testid="ai-requirements-input"]', prompt);
      await page.click('[data-testid="generate-ai-config"]');
      
      // Wait for configuration generation
      await expect(page.locator('[data-testid="ai-config-result"]')).toBeVisible({ timeout: 10000 });
      
      // Verify configuration was generated
      await expect(page.locator('[data-testid="matching-rules"]')).toBeVisible();
    }
  });

  test('should handle reconciliation errors gracefully', async ({ page }) => {
    // Navigate to reconciliation
    await page.click('[data-testid="reconciliation-tab"]');
    
    // Try to execute without files
    await page.click('[data-testid="execute-reconciliation"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Please upload files');
    
    // Upload invalid file
    await page.locator('input[type="file"]').first().setInputFiles('testing/fixtures/sample-files/invalid_file.txt');
    
    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Invalid file format');
  });

  test('@visual should match reconciliation page screenshot', async ({ page }) => {
    await page.click('[data-testid="reconciliation-tab"]');
    await expect(page).toHaveScreenshot('reconciliation-page.png');
  });
});

test.describe('Reconciliation Performance', () => {
  test('should handle large file reconciliation within time limit', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="reconciliation-tab"]');
    
    // Upload large test files
    await page.locator('input[type="file"]').first().setInputFiles('testing/fixtures/sample-files/large_recon_a.csv');
    await page.locator('input[type="file"]').nth(1).setInputFiles('testing/fixtures/sample-files/large_recon_b.csv');
    
    const startTime = Date.now();
    await page.click('[data-testid="execute-reconciliation"]');
    
    // Wait for results with extended timeout for large files
    await expect(page.locator('[data-testid="reconciliation-results"]')).toBeVisible({ timeout: 120000 });
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    // Verify processing completed within reasonable time (2 minutes for large files)
    expect(processingTime).toBeLessThan(120);
  });
});