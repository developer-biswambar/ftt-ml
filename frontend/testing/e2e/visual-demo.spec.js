// Visual Demo Tests - Shows exactly what's happening during testing
import { test, expect } from '@playwright/test';

test.describe('🎬 Visual UI Testing Demo', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable console logging to see what's happening
    page.on('console', msg => {
      console.log(`🌐 BROWSER: ${msg.text()}`);
    });
    
    page.on('request', request => {
      console.log(`🔗 REQUEST: ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      console.log(`📡 RESPONSE: ${response.status()} ${response.url()}`);
    });
  });

  test('🎯 Visual Reconciliation Workflow Demo', async ({ page }) => {
    console.log('🚀 STARTING: Visual Reconciliation Demo');
    
    // Step 1: Navigate to app
    console.log('📍 STEP 1: Navigating to application...');
    await page.goto('/');
    await page.waitForTimeout(2000); // Pause to see loading
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'testing/screenshots/01-app-loaded.png', fullPage: true });
    console.log('📸 Screenshot saved: 01-app-loaded.png');
    
    // Step 2: Navigate to reconciliation
    console.log('📍 STEP 2: Clicking on Reconciliation tab...');
    await page.locator('text=Reconciliation').click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'testing/screenshots/02-reconciliation-tab.png', fullPage: true });
    console.log('📸 Screenshot saved: 02-reconciliation-tab.png');
    
    // Step 3: Look for upload area
    console.log('📍 STEP 3: Looking for file upload area...');
    const uploadArea = page.locator('[data-testid="upload-area"], .upload-area, input[type="file"], text=upload, text=drag, text=drop').first();
    
    if (await uploadArea.isVisible()) {
      console.log('✅ Found upload area');
      await uploadArea.highlight();
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️ Upload area not found with test IDs, looking for alternative selectors...');
      
      // Try clicking on any button that might open upload
      const buttons = await page.locator('button').all();
      console.log(`🔍 Found ${buttons.length} buttons on page`);
      
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const button = buttons[i];
        const text = await button.textContent();
        console.log(`🔘 Button ${i + 1}: "${text}"`);
        
        if (text && (text.toLowerCase().includes('upload') || text.toLowerCase().includes('file') || text.toLowerCase().includes('add'))) {
          console.log(`✅ Clicking on: "${text}"`);
          await button.click();
          await page.waitForTimeout(1000);
          break;
        }
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/03-upload-interaction.png', fullPage: true });
    console.log('📸 Screenshot saved: 03-upload-interaction.png');
    
    // Step 4: Look for AI assistance
    console.log('📍 STEP 4: Looking for AI assistance features...');
    const aiButtons = page.locator('text=AI, text=Generate, text=Assistant, [data-testid*="ai"]');
    const aiCount = await aiButtons.count();
    console.log(`🤖 Found ${aiCount} potential AI elements`);
    
    if (aiCount > 0) {
      await aiButtons.first().highlight();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'testing/screenshots/04-ai-features.png', fullPage: true });
    console.log('📸 Screenshot saved: 04-ai-features.png');
    
    // Step 5: Explore the interface
    console.log('📍 STEP 5: Exploring interface elements...');
    
    // Highlight all interactive elements
    const interactives = page.locator('button, input, select, textarea, [role="button"], [tabindex="0"]');
    const count = await interactives.count();
    console.log(`🎯 Found ${count} interactive elements`);
    
    // Take final screenshot
    await page.screenshot({ path: 'testing/screenshots/05-final-state.png', fullPage: true });
    console.log('📸 Screenshot saved: 05-final-state.png');
    
    console.log('✅ COMPLETED: Visual Reconciliation Demo');
    console.log('📁 Check testing/screenshots/ for visual evidence');
  });

  test('🎬 Transformation Interface Exploration', async ({ page }) => {
    console.log('🚀 STARTING: Transformation Interface Demo');
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Navigate to transformation
    console.log('📍 Clicking on Transformation...');
    const transformationTab = page.locator('text=Transformation, text=Transform, [href*="transform"]').first();
    
    if (await transformationTab.isVisible()) {
      await transformationTab.click();
      await page.waitForTimeout(2000);
      console.log('✅ Transformation tab clicked');
    } else {
      console.log('⚠️ Transformation tab not found, checking navigation...');
      await page.screenshot({ path: 'testing/screenshots/transform-nav-issue.png' });
    }
    
    await page.screenshot({ path: 'testing/screenshots/transformation-interface.png', fullPage: true });
    console.log('📸 Screenshot saved: transformation-interface.png');
    
    console.log('✅ COMPLETED: Transformation Demo');
  });

  test('🔍 Delta Generation Interface', async ({ page }) => {
    console.log('🚀 STARTING: Delta Generation Demo');
    
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Look for delta/comparison features
    console.log('📍 Looking for Delta/Comparison features...');
    const deltaTab = page.locator('text=Delta, text=Compare, text=Diff, [href*="delta"]').first();
    
    if (await deltaTab.isVisible()) {
      await deltaTab.click();
      await page.waitForTimeout(2000);
      console.log('✅ Delta tab found and clicked');
    } else {
      console.log('⚠️ Delta tab not found');
    }
    
    await page.screenshot({ path: 'testing/screenshots/delta-interface.png', fullPage: true });
    console.log('📸 Screenshot saved: delta-interface.png');
    
    console.log('✅ COMPLETED: Delta Demo');
  });

  test('🎪 Complete Interface Tour', async ({ page }) => {
    console.log('🚀 STARTING: Complete Interface Tour');
    
    await page.goto('/');
    
    // Step 1: Identify main navigation
    console.log('📍 STEP 1: Identifying main navigation...');
    const navElements = page.locator('nav, [role="navigation"], .nav, .navigation, header');
    const navCount = await navElements.count();
    console.log(`🧭 Found ${navCount} navigation elements`);
    
    if (navCount > 0) {
      await navElements.first().highlight();
      await page.waitForTimeout(2000);
    }
    
    // Step 2: Find all tabs/sections
    console.log('📍 STEP 2: Finding all tabs and sections...');
    const tabs = page.locator('button, a, [role="tab"], .tab');
    const tabCount = await tabs.count();
    console.log(`📑 Found ${tabCount} potential tabs`);
    
    // Step 3: Take screenshots of each major section
    const sections = ['Reconciliation', 'Transformation', 'Delta', 'File', 'Library', 'View'];
    
    for (const section of sections) {
      console.log(`📍 Looking for ${section} section...`);
      const sectionElement = page.locator(`text=${section}`).first();
      
      if (await sectionElement.isVisible()) {
        console.log(`✅ Found ${section} section`);
        await sectionElement.click();
        await page.waitForTimeout(2000);
        
        await page.screenshot({ 
          path: `testing/screenshots/section-${section.toLowerCase()}.png`, 
          fullPage: true 
        });
        console.log(`📸 Screenshot saved: section-${section.toLowerCase()}.png`);
      } else {
        console.log(`⚠️ ${section} section not found`);
      }
    }
    
    console.log('✅ COMPLETED: Complete Interface Tour');
    console.log('📁 Check testing/screenshots/ for all interface screenshots');
  });

  test('🚨 Error State Testing', async ({ page }) => {
    console.log('🚀 STARTING: Error State Testing');
    
    await page.goto('/');
    
    // Test 1: Try to process without files
    console.log('📍 TEST 1: Attempting to process without files...');
    const processButtons = page.locator('button').filter({ hasText: /process|run|execute|start/i });
    const processCount = await processButtons.count();
    console.log(`⚙️ Found ${processCount} process buttons`);
    
    if (processCount > 0) {
      await processButtons.first().click();
      await page.waitForTimeout(2000);
      
      // Look for error messages
      const errors = page.locator('.error, [class*="error"], text=error, text=required').first();
      if (await errors.isVisible()) {
        console.log('✅ Error handling working - found error message');
        await errors.highlight();
        await page.waitForTimeout(2000);
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/error-states.png', fullPage: true });
    console.log('📸 Screenshot saved: error-states.png');
    
    console.log('✅ COMPLETED: Error State Testing');
  });
});