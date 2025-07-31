import { test, expect } from '@playwright/test';

test.describe('File Upload & Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should upload and process CSV files successfully', async ({ page }) => {
    // Test file upload modal
    await page.click('[data-testid="upload-files-button"]');
    await expect(page.locator('[data-testid="file-upload-modal"]')).toBeVisible();

    // Upload a valid CSV file
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/test_data.csv');
    await page.fill('[data-testid="file-label-input"]', 'Test Data File');
    await page.fill('[data-testid="file-description-input"]', 'Sample test data for validation');
    
    // Upload file
    await page.click('[data-testid="upload-button"]');
    
    // Wait for processing
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
    
    // Verify file information is displayed
    await expect(page.locator('[data-testid="file-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-count"]')).toContainText('4'); // Expected columns
    await expect(page.locator('[data-testid="row-count"]')).toContainText('100'); // Expected rows
    
    // Check data preview
    await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-table"]')).toBeVisible();
  });

  test('should handle multiple file uploads', async ({ page }) => {
    await page.click('[data-testid="upload-files-button"]');
    
    // Upload multiple files
    const files = [
      'testing/fixtures/sample-files/file_a.csv',
      'testing/fixtures/sample-files/file_b.csv',
      'testing/fixtures/sample-files/file_c.csv'
    ];
    
    for (let i = 0; i < files.length; i++) {
      await page.locator('input[type="file"]').setInputFiles(files[i]);
      await page.fill('[data-testid="file-label-input"]', `Test File ${i + 1}`);
      await page.click('[data-testid="upload-button"]');
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      
      if (i < files.length - 1) {
        await page.click('[data-testid="upload-another"]');
      }
    }
    
    // Verify all files are listed
    await page.click('[data-testid="close-modal"]');
    await page.click('[data-testid="file-library-tab"]');
    await expect(page.locator('[data-testid="uploaded-files-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(3);
  });

  test('should validate file formats and sizes', async ({ page }) => {
    await page.click('[data-testid="upload-files-button"]');
    
    // Test unsupported file format
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/invalid_file.txt');
    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="format-error"]')).toContainText('Unsupported file format');
    
    // Test file size limit (simulate large file)
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/large_file.csv');
    await page.click('[data-testid="upload-button"]');
    
    // Should show size warning or processing indicator for large files
    const sizeWarning = page.locator('[data-testid="size-warning"]');
    const processingIndicator = page.locator('[data-testid="large-file-processing"]');
    
    await expect(sizeWarning.or(processingIndicator)).toBeVisible();
  });

  test('should handle file processing errors gracefully', async ({ page }) => {
    await page.click('[data-testid="upload-files-button"]');
    
    // Upload malformed CSV
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/malformed_data.csv');
    await page.fill('[data-testid="file-label-input"]', 'Malformed File');
    await page.click('[data-testid="upload-button"]');
    
    // Should show processing error
    await expect(page.locator('[data-testid="processing-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-details"]')).toContainText('Data format error');
    
    // Should provide option to retry or cancel
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-button"]')).toBeVisible();
  });

  test('should support Excel file uploads', async ({ page }) => {
    await page.click('[data-testid="upload-files-button"]');
    
    // Upload Excel file
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/test_data.xlsx');
    await page.fill('[data-testid="file-label-input"]', 'Excel Test Data');
    await page.click('[data-testid="upload-button"]');
    
    // Wait for Excel processing (may take longer)
    await expect(page.locator('[data-testid="excel-processing"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 15000 });
    
    // Should detect sheets if multiple
    const sheetSelector = page.locator('[data-testid="sheet-selector"]');
    if (await sheetSelector.isVisible()) {
      await sheetSelector.selectOption('Sheet1');
      await page.click('[data-testid="select-sheet"]');
    }
    
    // Verify Excel data is processed correctly
    await expect(page.locator('[data-testid="file-info"]')).toBeVisible();
  });

  test('should show upload progress for large files', async ({ page }) => {
    await page.click('[data-testid="upload-files-button"]');
    
    // Upload large file to test progress indicator
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/large_test_data.csv');
    await page.fill('[data-testid="file-label-input"]', 'Large File');
    await page.click('[data-testid="upload-button"]');
    
    // Should show progress bar
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible();
    
    // Progress should complete
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
  });

  test('should manage uploaded files in library', async ({ page }) => {
    // Upload a file first
    await page.click('[data-testid="upload-files-button"]');
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/test_data.csv');
    await page.fill('[data-testid="file-label-input"]', 'Library Test File');
    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // Navigate to file library
    await page.click('[data-testid="close-modal"]');
    await page.click('[data-testid="file-library-tab"]');
    
    // Verify file appears in library
    await expect(page.locator('[data-testid="file-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-name"]')).toContainText('Library Test File');
    
    // Test file actions
    await page.click('[data-testid="file-actions-menu"]');
    await expect(page.locator('[data-testid="view-file"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-file"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-file"]')).toBeVisible();
    
    // View file details
    await page.click('[data-testid="view-file"]');
    await expect(page.locator('[data-testid="file-viewer"]')).toBeVisible();
    
    // Delete file
    await page.click('[data-testid="file-actions-menu"]');
    await page.click('[data-testid="delete-file"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify file is removed
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(0);
  });

  test('@visual should match file upload modal screenshot', async ({ page }) => {
    await page.click('[data-testid="upload-files-button"]');
    await expect(page.locator('[data-testid="file-upload-modal"]')).toBeVisible();
    await expect(page).toHaveScreenshot('file-upload-modal.png');
  });
});