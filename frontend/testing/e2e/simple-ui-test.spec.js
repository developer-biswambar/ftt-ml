// Simple UI Test - Just Chrome, focused on what works
import { test, expect } from '@playwright/test';

test.describe('🎯 Focused UI Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable detailed logging
    page.on('console', msg => {
      console.log(`🌐 BROWSER: ${msg.text()}`);
    });
    
    page.on('request', request => {
      if (!request.url().includes('hot-update')) {
        console.log(`🔗 REQUEST: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      if (!response.url().includes('hot-update') && !response.url().includes('@vite')) {
        console.log(`📡 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });
    
    // Navigate and wait for app to load
    console.log('🚀 Loading application...');
    await page.goto('/');
    
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Take screenshot of what actually loaded
    await page.screenshot({ path: 'testing/screenshots/app-actual-state.png', fullPage: true });
    console.log('📸 Screenshot saved: app-actual-state.png');
  });

  test('🔍 Discover What UI Elements Exist', async ({ page }) => {
    console.log('🔍 ANALYZING: What UI elements are actually present...');
    
    // Check page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    
    // Find all text content
    const bodyText = await page.textContent('body');
    console.log(`📝 Page contains text: ${bodyText ? 'YES' : 'NO'}`);
    if (bodyText) {
      const words = bodyText.split(/\s+/).filter(w => w.length > 3);
      console.log(`🔤 Key words found: ${words.slice(0, 10).join(', ')}...`);
    }
    
    // Find all buttons
    const buttons = await page.locator('button').all();
    console.log(`🔘 Found ${buttons.length} buttons:`);
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const visible = await button.isVisible();
      console.log(`   ${i + 1}: "${text}" (visible: ${visible})`);
    }
    
    // Find all links
    const links = await page.locator('a').all();
    console.log(`🔗 Found ${links.length} links:`);
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      const link = links[i];
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      console.log(`   ${i + 1}: "${text}" (href: ${href})`);
    }
    
    // Find navigation elements
    const navElements = await page.locator('nav, [role="navigation"], .nav, .navigation, header').all();
    console.log(`🧭 Found ${navElements.length} navigation elements`);
    
    // Find form elements
    const inputs = await page.locator('input').all();
    const selects = await page.locator('select').all();
    const textareas = await page.locator('textarea').all();
    console.log(`📝 Form elements: ${inputs.length} inputs, ${selects.length} selects, ${textareas.length} textareas`);
    
    // Look for common UI patterns
    const tabs = await page.locator('[role="tab"], .tab, [data-testid*="tab"]').all();
    console.log(`📑 Found ${tabs.length} tab-like elements`);
    
    // Check for any text mentioning key features
    const features = ['reconciliation', 'transformation', 'delta', 'file', 'upload', 'AI'];
    for (const feature of features) {
      const elements = await page.locator(`text=${feature}`).all();
      console.log(`🔍 "${feature}": ${elements.length} mentions found`);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'testing/screenshots/ui-analysis-complete.png', fullPage: true });
    console.log('📸 Screenshot saved: ui-analysis-complete.png');
    
    console.log('✅ UI Analysis Complete - Check console output above for details');
  });

  test('🎯 Test Whatever Navigation Exists', async ({ page }) => {
    console.log('🎯 TESTING: Available navigation...');
    
    // Try to find and click any clickable navigation elements
    const clickableElements = await page.locator('button, a, [role="button"], [tabindex="0"]').all();
    console.log(`🖱️ Found ${clickableElements.length} clickable elements`);
    
    for (let i = 0; i < Math.min(clickableElements.length, 5); i++) {
      const element = clickableElements[i];
      
      try {
        const text = await element.textContent();
        const tagName = await element.evaluate(el => el.tagName);
        const isVisible = await element.isVisible();
        
        console.log(`🖱️ Testing element ${i + 1}: ${tagName} "${text}" (visible: ${isVisible})`);
        
        if (isVisible && text && text.trim().length > 0) {
          console.log(`   ➡️ Clicking: "${text}"`);
          
          // Take screenshot before click
          await page.screenshot({ 
            path: `testing/screenshots/before-click-${i + 1}.png`, 
            fullPage: true 
          });
          
          await element.click();
          await page.waitForTimeout(1000);
          
          // Take screenshot after click
          await page.screenshot({ 
            path: `testing/screenshots/after-click-${i + 1}.png`, 
            fullPage: true 
          });
          
          console.log(`   ✅ Click completed`);
        } else {
          console.log(`   ⏭️ Skipping: not visible or no text`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error clicking element ${i + 1}: ${error.message}`);
      }
    }
    
    console.log('✅ Navigation testing complete');
  });

  test('📁 Test File Input if Present', async ({ page }) => {
    console.log('📁 TESTING: File input functionality...');
    
    // Look for file inputs
    const fileInputs = await page.locator('input[type="file"]').all();
    console.log(`📁 Found ${fileInputs.length} file input elements`);
    
    if (fileInputs.length > 0) {
      console.log('✅ File inputs found - file upload is supported');
      
      // Take screenshot of file input area
      await page.screenshot({ path: 'testing/screenshots/file-inputs-found.png', fullPage: true });
      
      // Try to interact with first file input
      const firstInput = fileInputs[0];
      const isVisible = await firstInput.isVisible();
      console.log(`📁 First file input visible: ${isVisible}`);
      
      if (isVisible) {
        // Create a simple test file if it doesn't exist
        const testFilePath = 'testing/fixtures/simple-test.csv';
        const testContent = 'ID,Name,Value\n1,Test,100\n2,Demo,200';
        
        // Write test file
        const fs = await import('fs');
        const path = await import('path');
        
        const fullPath = path.join(process.cwd(), testFilePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, testContent);
        
        console.log(`📁 Created test file: ${testFilePath}`);
        
        // Try to upload the file
        try {
          await firstInput.setInputFiles(fullPath);
          console.log('✅ File upload successful');
          
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'testing/screenshots/file-uploaded.png', fullPage: true });
          
        } catch (error) {
          console.log(`❌ File upload failed: ${error.message}`);
        }
      }
      
    } else {
      console.log('⚠️ No file inputs found - file upload may not be implemented yet');
    }
    
    console.log('✅ File input testing complete');
  });

  test('🌐 Test API Integration', async ({ page }) => {
    console.log('🌐 TESTING: API integration...');
    
    // Listen for API calls
    const apiCalls = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          method: request.method(),
          url: request.url(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Try to trigger some API calls by interacting with UI
    const buttons = await page.locator('button').all();
    
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const isVisible = await button.isVisible();
      
      if (isVisible && text && (
        text.toLowerCase().includes('load') ||
        text.toLowerCase().includes('fetch') ||
        text.toLowerCase().includes('get') ||
        text.toLowerCase().includes('process')
      )) {
        console.log(`🌐 Clicking button that might trigger API: "${text}"`);
        
        try {
          await button.click();
          await page.waitForTimeout(2000);
        } catch (error) {
          console.log(`❌ Error clicking button: ${error.message}`);
        }
      }
    }
    
    console.log(`🌐 Captured ${apiCalls.length} API calls:`);
    apiCalls.forEach((call, index) => {
      console.log(`   ${index + 1}: ${call.method} ${call.url}`);
    });
    
    if (apiCalls.length === 0) {
      console.log('⚠️ No API calls detected - may need user interaction to trigger');
    }
    
    console.log('✅ API integration testing complete');
  });

  test('📊 Generate Final Report', async ({ page }) => {
    console.log('📊 GENERATING: Final UI test report...');
    
    // Collect final state information
    const url = page.url();
    const title = await page.title();
    const bodyText = await page.textContent('body');
    
    // Count various elements
    const elementCounts = {
      buttons: await page.locator('button').count(),
      links: await page.locator('a').count(),
      inputs: await page.locator('input').count(),
      forms: await page.locator('form').count(),
      images: await page.locator('img').count(),
      divs: await page.locator('div').count()
    };
    
    // Take final comprehensive screenshot
    await page.screenshot({ path: 'testing/screenshots/final-ui-state.png', fullPage: true });
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      url: url,
      title: title,
      hasContent: !!bodyText && bodyText.trim().length > 0,
      elementCounts: elementCounts,
      screenshots: [
        'app-actual-state.png',
        'ui-analysis-complete.png',
        'final-ui-state.png'
      ]
    };
    
    console.log('📊 FINAL REPORT:');
    console.log(`   URL: ${report.url}`);
    console.log(`   Title: ${report.title}`);
    console.log(`   Has Content: ${report.hasContent}`);
    console.log(`   Elements Found:`);
    Object.entries(report.elementCounts).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    console.log(`   Screenshots: ${report.screenshots.length} saved`);
    
    // Save report to file
    const fs = await import('fs');
    const path = await import('path');
    const reportPath = path.join(process.cwd(), 'testing', 'reports', 'ui-discovery-report.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved: ${reportPath}`);
    
    console.log('✅ Final report generation complete');
  });
});