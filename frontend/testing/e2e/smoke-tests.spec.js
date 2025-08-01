// Smoke Tests - Quick verification of core functionality
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Quick Core Verification', () => {
  
  test('🚀 App Loads and Basic Navigation', async ({ page }) => {
    await page.goto('/');
    
    // Verify app loads
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible();
    
    // Test all main tabs
    const tabs = ['reconciliation', 'transformation', 'delta', 'file-library'];
    for (const tab of tabs) {
      await page.click(`[data-testid="${tab}-tab"]`);
      await expect(page.locator(`[data-testid="${tab}-content"]`)).toBeVisible();
    }
  });

  test('🔄 File Upload Basic Functionality', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="reconciliation-tab"]');
    
    // Test file upload modal
    await page.click('[data-testid="upload-files-btn"]');
    await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible();
    
    // Test drag and drop area
    await expect(page.locator('[data-testid="drag-drop-area"]')).toBeVisible();
    
    // Close modal
    await page.click('[data-testid="close-modal"]');
    await expect(page.locator('[data-testid="upload-modal"]')).not.toBeVisible();
  });

  test('🤖 AI Integration Accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Test AI assistance availability
    await page.click('[data-testid="reconciliation-tab"]');
    await expect(page.locator('[data-testid="ai-assistance-btn"]')).toBeVisible();
    
    await page.click('[data-testid="transformation-tab"]');
    await expect(page.locator('[data-testid="ai-mapping-btn"]')).toBeVisible();
    
    // Test AI regex generator
    await page.click('[data-testid="ai-regex-generator"]');
    await expect(page.locator('[data-testid="regex-input-area"]')).toBeVisible();
  });

  test('📊 Data Viewer Access', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to file library
    await page.click('[data-testid="file-library-tab"]');
    await expect(page.locator('[data-testid="file-list-container"]')).toBeVisible();
    
    // Navigate to viewer page
    await page.click('[data-testid="viewer-tab"]');
    await expect(page.locator('[data-testid="viewer-interface"]')).toBeVisible();
  });

  test('⚙️ Configuration UI Elements', async ({ page }) => {
    await page.goto('/');
    
    // Test reconciliation configuration
    await page.click('[data-testid="reconciliation-tab"]');
    await expect(page.locator('[data-testid="config-section"]')).toBeVisible();
    
    // Test transformation rule builder
    await page.click('[data-testid="transformation-tab"]');
    await expect(page.locator('[data-testid="rule-builder"]')).toBeVisible();
    
    // Test delta configuration
    await page.click('[data-testid="delta-tab"]');
    await expect(page.locator('[data-testid="delta-config"]')).toBeVisible();
  });

  test('🔧 Error States and Loading States', async ({ page }) => {
    await page.goto('/');
    
    // Test loading states
    await page.click('[data-testid="reconciliation-tab"]');
    
    // Mock slow API response
    await page.route('**/api/reconciliation/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    await page.click('[data-testid="fetch-data-btn"]');
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  });

  test('📱 Responsive Design Check', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
  });

  test('🎨 Theme and Accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Test color contrast (basic check)
    const backgroundColor = await page.locator('body').evaluate(el => 
      getComputedStyle(el).backgroundColor
    );
    const textColor = await page.locator('body').evaluate(el => 
      getComputedStyle(el).color
    );
    
    expect(backgroundColor).toBeTruthy();
    expect(textColor).toBeTruthy();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('🔍 Search and Filter UI', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="file-library-tab"]');
    
    // Test search functionality exists
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    
    // Test filter controls exist
    await expect(page.locator('[data-testid="filter-controls"]')).toBeVisible();
    
    // Test sort controls exist
    await expect(page.locator('[data-testid="sort-controls"]')).toBeVisible();
  });

  test('💾 State Persistence Check', async ({ page }) => {
    await page.goto('/');
    
    // Make some state changes
    await page.click('[data-testid="reconciliation-tab"]');
    await page.fill('[data-testid="config-input"]', 'test configuration');
    
    // Refresh page
    await page.reload();
    
    // Check if state persists (if implemented)
    await page.click('[data-testid="reconciliation-tab"]');
    // This test depends on your state management implementation
  });
});