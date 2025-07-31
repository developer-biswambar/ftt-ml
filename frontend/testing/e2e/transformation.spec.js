import { test, expect } from '@playwright/test';

test.describe('Transformation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete full transformation workflow', async ({ page }) => {
    // Navigate to transformation
    await page.click('[data-testid="transformation-tab"]');
    await expect(page.locator('h2')).toContainText('Data Transformation');

    // Upload source file
    await page.locator('input[type="file"]').setInputFiles('testing/fixtures/sample-files/customer_sales_test.csv');
    await page.fill('[data-testid="file-label-input"]', 'Customer Sales Data');
    await page.click('[data-testid="upload-button"]');
    
    // Wait for upload and column detection
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="detected-columns"]')).toBeVisible();

    // Define output schema
    await page.click('[data-testid="next-step"]'); // Move to schema definition
    
    await page.click('[data-testid="add-column"]');
    await page.fill('[data-testid="column-name-0"]', 'customer_id');
    await page.selectOption('[data-testid="column-type-0"]', 'string');
    
    await page.click('[data-testid="add-column"]');
    await page.fill('[data-testid="column-name-1"]', 'full_name');
    await page.selectOption('[data-testid="column-type-1"]', 'string');
    
    await page.click('[data-testid="add-column"]');
    await page.fill('[data-testid="column-name-2"]', 'total_amount');
    await page.selectOption('[data-testid="column-type-2"]', 'number');

    // Use AI to generate transformation rules
    await page.click('[data-testid="next-step"]'); // Move to AI requirements
    await page.fill('[data-testid="ai-requirements-input"]', 
      'Create a customer summary with full name from first and last name, and total amount from quantity times unit price');
    
    await page.click('[data-testid="generate-ai-config"]');
    
    // Wait for AI configuration
    await expect(page.locator('[data-testid="ai-config-success"]')).toBeVisible({ timeout: 10000 });

    // Review and execute transformation
    await page.click('[data-testid="next-step"]'); // Move to preview
    await expect(page.locator('[data-testid="transformation-preview"]')).toBeVisible();
    
    await page.click('[data-testid="execute-transformation"]');
    
    // Wait for transformation results
    await expect(page.locator('[data-testid="transformation-results"]')).toBeVisible({ timeout: 30000 });
    
    // Verify transformed data
    await expect(page.locator('[data-testid="output-rows"]')).toContainText('15'); // Expected row count
    await expect(page.locator('[data-testid="output-columns"]')).toContainText('3'); // Expected column count
    
    // Export transformed data
    await page.click('[data-testid="export-results"]');
    await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
  });

  test('should handle manual column mapping', async ({ page }) => {
    await page.click('[data-testid="transformation-tab"]');
    
    // Upload file (assuming file already uploaded)
    // Navigate to column mapping step
    await page.click('[data-testid="manual-configuration-tab"]');
    await page.click('[data-testid="column-mapping-step"]');
    
    // Map source columns to target columns
    await page.selectOption('[data-testid="mapping-source-0"]', 'customer_id');
    await page.selectOption('[data-testid="mapping-target-0"]', 'customer_id');
    
    await page.click('[data-testid="add-mapping"]');
    await page.selectOption('[data-testid="mapping-source-1"]', 'first_name');
    await page.selectOption('[data-testid="mapping-target-1"]', 'full_name');
    await page.selectOption('[data-testid="mapping-type-1"]', 'expression');
    await page.fill('[data-testid="mapping-formula-1"]', '{first_name} + " " + {last_name}');
    
    // Execute transformation
    await page.click('[data-testid="execute-transformation"]');
    await expect(page.locator('[data-testid="transformation-results"]')).toBeVisible({ timeout: 30000 });
  });

  test('should support row generation rules', async ({ page }) => {
    await page.click('[data-testid="transformation-tab"]');
    
    // Navigate to row generation step
    await page.click('[data-testid="row-generation-step"]');
    
    // Add row expansion rule
    await page.click('[data-testid="add-row-rule"]');
    await page.selectOption('[data-testid="rule-type"]', 'expand');
    await page.fill('[data-testid="rule-name"]', 'Tax Line Items');
    
    await page.click('[data-testid="add-expansion"]');
    await page.fill('[data-testid="expansion-condition-0"]', 'line_type=base_amount');
    
    await page.click('[data-testid="add-expansion"]');
    await page.fill('[data-testid="expansion-condition-1"]', 'line_type=tax_amount');
    
    // Execute with row generation
    await page.click('[data-testid="execute-transformation"]');
    
    // Verify rows were expanded (should double the original count)
    await expect(page.locator('[data-testid="transformation-results"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="output-rows"]')).toContainText('30'); // 15 * 2
  });

  test('should validate transformation configuration', async ({ page }) => {
    await page.click('[data-testid="transformation-tab"]');
    
    // Try invalid configuration
    await page.click('[data-testid="execute-transformation"]');
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('No transformation rules defined');
    
    // Try invalid formula
    await page.click('[data-testid="column-mapping-step"]');
    await page.selectOption('[data-testid="mapping-type-0"]', 'expression');
    await page.fill('[data-testid="mapping-formula-0"]', 'invalid formula {}}');
    
    await page.click('[data-testid="validate-formula"]');
    await expect(page.locator('[data-testid="formula-error"]')).toContainText('Invalid formula syntax');
  });

  test('@visual should match transformation page screenshot', async ({ page }) => {
    await page.click('[data-testid="transformation-tab"]');
    await expect(page).toHaveScreenshot('transformation-page.png');
  });
});