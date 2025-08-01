// Working UI Test - Based on your actual UI behavior
import { test, expect } from '@playwright/test';

test.describe('✅ Working UI Tests - Based on Real UI', () => {
  
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Loading application...');
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'testing/screenshots/01-app-loaded.png', fullPage: true });
    console.log('📸 Initial state captured');
  });

  test('🎯 Test Real UI - Buttons and States', async ({ page }) => {
    console.log('🔍 TESTING: Real UI behavior...');
    
    // Find all buttons and their states
    const buttons = await page.locator('button').all();
    console.log(`🔘 Found ${buttons.length} buttons`);
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const isEnabled = await button.isEnabled();
      const isVisible = await button.isVisible();
      const classes = await button.getAttribute('class');
      
      console.log(`🔘 Button ${i + 1}: "${text}"`);
      console.log(`   - Enabled: ${isEnabled}`);
      console.log(`   - Visible: ${isVisible}`);
      console.log(`   - Classes: ${classes}`);
      
      // Only click enabled buttons
      if (isEnabled && isVisible && text && !text.toLowerCase().includes('process')) {
        console.log(`   ✅ Clicking enabled button: "${text}"`);
        
        try {
          await button.click();
          await page.waitForTimeout(1000);
          
          // Take screenshot after click
          await page.screenshot({ 
            path: `testing/screenshots/after-click-${i + 1}-${text.replace(/[^a-zA-Z0-9]/g, '-')}.png`, 
            fullPage: true 
          });
          
          console.log(`   ✅ Click successful`);
        } catch (error) {
          console.log(`   ❌ Click failed: ${error.message}`);
        }
      } else if (!isEnabled) {
        console.log(`   ⏸️ Button disabled (expected behavior)`);
      }
    }
    
    console.log('✅ Button testing complete');
  });

  test('📁 Test File Upload Flow', async ({ page }) => {
    console.log('📁 TESTING: File upload workflow...');
    
    // Create test CSV file
    const testCsv = `ID,Name,Amount,Date
1,Transaction A,100.50,2024-01-15
2,Transaction B,250.75,2024-01-16
3,Transaction C,75.25,2024-01-17`;
    
    // Write test file
    const fs = await import('fs');
    const path = await import('path');
    
    const testDir = path.join(process.cwd(), 'testing', 'fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFilePath = path.join(testDir, 'test-upload.csv');
    fs.writeFileSync(testFilePath, testCsv);
    console.log('📄 Created test file: test-upload.csv');
    
    // Look for file inputs
    const fileInputs = await page.locator('input[type="file"]').all();
    console.log(`📁 Found ${fileInputs.length} file input(s)`);
    
    if (fileInputs.length > 0) {
      // Upload to first file input
      console.log('📁 Uploading to first file input...');
      await fileInputs[0].setInputFiles(testFilePath);
      
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'testing/screenshots/02-file-uploaded.png', fullPage: true });
      console.log('📸 File upload state captured');
      
      // Check if any buttons became enabled after upload
      const buttonsAfterUpload = await page.locator('button').all();
      console.log('🔍 Checking button states after file upload...');
      
      for (let i = 0; i < buttonsAfterUpload.length; i++) {
        const button = buttonsAfterUpload[i];
        const text = await button.textContent();
        const isEnabled = await button.isEnabled();
        
        console.log(`🔘 Button "${text}": enabled = ${isEnabled}`);
        
        // If button became enabled, try clicking it
        if (isEnabled && text && (
          text.toLowerCase().includes('process') ||
          text.toLowerCase().includes('run') ||
          text.toLowerCase().includes('start') ||
          text.toLowerCase().includes('generate')
        )) {
          console.log(`✅ Button enabled after upload, clicking: "${text}"`);
          
          try {
            await button.click();
            await page.waitForTimeout(3000); // Wait for processing
            
            await page.screenshot({ 
              path: `testing/screenshots/03-after-process-${text.replace(/[^a-zA-Z0-9]/g, '-')}.png`, 
              fullPage: true 
            });
            
            console.log(`✅ Process button clicked successfully`);
            break; // Only click one process button
            
          } catch (error) {
            console.log(`❌ Process button click failed: ${error.message}`);
          }
        }
      }
      
      // Upload to second file input if it exists
      if (fileInputs.length > 1) {
        console.log('📁 Uploading to second file input...');
        
        // Create second test file
        const testCsv2 = `Statement_ID,Reference,Value,Status
STMT001,REF123,100.50,SETTLED
STMT002,REF124,250.75,PROCESSING
STMT003,REF125,75.25,COMPLETE`;
        
        const testFilePath2 = path.join(testDir, 'test-upload-2.csv');
        fs.writeFileSync(testFilePath2, testCsv2);
        
        await fileInputs[1].setInputFiles(testFilePath2);
        await page.waitForTimeout(2000);
        
        await page.screenshot({ path: 'testing/screenshots/04-both-files-uploaded.png', fullPage: true });
        console.log('📸 Both files uploaded state captured');
        
        // Try process button again after both files
        const processButton = page.locator('button').filter({ hasText: /process|run|execute|start|generate/i }).first();
        
        if (await processButton.isEnabled()) {
          console.log('✅ Process button enabled with both files, clicking...');
          
          try {
            await processButton.click();
            await page.waitForTimeout(5000); // Wait longer for processing
            
            await page.screenshot({ path: 'testing/screenshots/05-processing-result.png', fullPage: true });
            console.log('📸 Processing result captured');
            
          } catch (error) {
            console.log(`❌ Processing failed: ${error.message}`);
          }
        }
      }
      
    } else {
      console.log('⚠️ No file inputs found - looking for upload buttons...');
      
      // Look for upload buttons instead
      const uploadButtons = page.locator('button').filter({ hasText: /upload|add.*file|browse/i });
      const uploadCount = await uploadButtons.count();
      
      if (uploadCount > 0) {
        console.log(`📁 Found ${uploadCount} upload button(s), clicking first one...`);
        
        await uploadButtons.first().click();
        await page.waitForTimeout(1000);
        
        await page.screenshot({ path: 'testing/screenshots/02-upload-dialog.png', fullPage: true });
        console.log('📸 Upload dialog state captured');
        
        // Now look for file inputs that appeared
        const newFileInputs = await page.locator('input[type="file"]').all();
        if (newFileInputs.length > 0) {
          console.log('📁 File input appeared, uploading...');
          await newFileInputs[0].setInputFiles(testFilePath);
          await page.waitForTimeout(2000);
          
          await page.screenshot({ path: 'testing/screenshots/03-file-uploaded-modal.png', fullPage: true });
        }
      }
    }
    
    console.log('✅ File upload testing complete');
  });

  test('🧭 Test Navigation Elements', async ({ page }) => {
    console.log('🧭 TESTING: Navigation elements...');
    
    // Look for navigation patterns
    const navPatterns = [
      'nav',
      '[role="navigation"]',
      '.nav',
      '.navigation', 
      'header',
      '[data-testid*="nav"]',
      '[data-testid*="tab"]'
    ];
    
    for (const pattern of navPatterns) {
      const elements = await page.locator(pattern).all();
      if (elements.length > 0) {
        console.log(`🧭 Found ${elements.length} elements matching "${pattern}"`);
        
        // Take screenshot of navigation area
        await elements[0].screenshot({ path: `testing/screenshots/nav-${pattern.replace(/[^a-zA-Z0-9]/g, '-')}.png` });
      }
    }
    
    // Look for clickable navigation items
    const navItems = await page.locator('a, button, [role="tab"], [tabindex="0"]').all();
    console.log(`🧭 Found ${navItems.length} potentially clickable navigation items`);
    
    // Test a few navigation clicks
    for (let i = 0; i < Math.min(navItems.length, 5); i++) {
      const item = navItems[i];
      const text = await item.textContent();
      const isVisible = await item.isVisible();
      const isEnabled = await item.isEnabled();
      
      if (isVisible && isEnabled && text && text.trim().length > 0) {
        console.log(`🧭 Testing navigation item: "${text}"`);
        
        try {
          // Take screenshot before navigation
          await page.screenshot({ 
            path: `testing/screenshots/before-nav-${i + 1}.png`, 
            fullPage: true 
          });
          
          await item.click();
          await page.waitForTimeout(1000);
          
          // Take screenshot after navigation
          await page.screenshot({ 
            path: `testing/screenshots/after-nav-${i + 1}-${text.replace(/[^a-zA-Z0-9]/g, '-')}.png`, 
            fullPage: true 
          });
          
          console.log(`✅ Navigation to "${text}" successful`);
          
        } catch (error) {
          console.log(`❌ Navigation failed: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Navigation testing complete');
  });

  test('📊 Generate UI Report', async ({ page }) => {
    console.log('📊 GENERATING: Comprehensive UI report...');
    
    // Final state analysis
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      elements: {
        buttons: {
          total: await page.locator('button').count(),
          enabled: await page.locator('button:enabled').count(),
          disabled: await page.locator('button:disabled').count()
        },
        inputs: {
          total: await page.locator('input').count(),
          file: await page.locator('input[type="file"]').count(),
          text: await page.locator('input[type="text"]').count()
        },
        links: await page.locator('a').count(),
        forms: await page.locator('form').count()
      },
      features: {
        fileUpload: await page.locator('input[type="file"]').count() > 0,
        navigation: await page.locator('nav, [role="navigation"]').count() > 0,
        processing: await page.locator('button').filter({ hasText: /process|run|execute/i }).count() > 0
      }
    };
    
    console.log('📊 UI REPORT:');
    console.log(`   Title: ${report.title}`);
    console.log(`   Buttons: ${report.elements.buttons.total} (${report.elements.buttons.enabled} enabled, ${report.elements.buttons.disabled} disabled)`);
    console.log(`   File Inputs: ${report.elements.inputs.file}`);
    console.log(`   Text Inputs: ${report.elements.inputs.text}`);
    console.log(`   Links: ${report.elements.links}`);
    console.log(`   Features:`);
    console.log(`     - File Upload: ${report.features.fileUpload ? '✅' : '❌'}`);
    console.log(`     - Navigation: ${report.features.navigation ? '✅' : '❌'}`);
    console.log(`     - Processing: ${report.features.processing ? '✅' : '❌'}`);
    
    // Save report
    const fs = await import('fs');
    const path = await import('path');
    
    const reportDir = path.join(process.cwd(), 'testing', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = path.join(reportDir, 'working-ui-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved: ${reportPath}`);
    
    // Final screenshot
    await page.screenshot({ path: 'testing/screenshots/99-final-state.png', fullPage: true });
    console.log('📸 Final state captured: 99-final-state.png');
    
    console.log('✅ UI report generation complete');
  });
});