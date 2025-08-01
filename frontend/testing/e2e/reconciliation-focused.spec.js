// Focused Reconciliation Test - Based on Actual UI Behavior
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('🎯 Focused Reconciliation Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Loading reconciliation interface...');
    
    // Enable browser logging
    page.on('console', msg => {
      if (!msg.text().includes('Download the React DevTools')) {
        console.log(`🌐 BROWSER: ${msg.text()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Navigate to reconciliation
    const reconElement = page.locator('text=Reconciliation').first();
    if (await reconElement.isVisible()) {
      await reconElement.click();
      console.log('✅ Navigated to Reconciliation');
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-focused-start.png', fullPage: true });
  });

  test('📁 Test File Upload and UI Response', async ({ page }) => {
    console.log('📁 TESTING: File upload behavior...');
    
    // Create test files
    const testDir = path.join(process.cwd(), 'testing', 'fixtures', 'reconciliation');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const fileAContent = `Transaction_ID,Reference_Number,Amount,Transaction_Date,Status
TXN001,REF12345,1000.50,2024-01-15,SETTLED
TXN002,REF12346,2500.75,2024-01-15,SETTLED
TXN003,REF12347,750.25,2024-01-16,PROCESSING`;
    
    const fileBContent = `Statement_ID,Reference,Value,Date_Processed,Bank_Status
STMT001,REF12345,1000.50,15/01/2024,Settled
STMT002,REF12346,2500.75,15/01/2024,Settled
STMT003,REF12347,750.25,16/01/2024,Processing`;
    
    const fileAPath = path.join(testDir, 'focused-test-file-a.csv');
    const fileBPath = path.join(testDir, 'focused-test-file-b.csv');
    
    fs.writeFileSync(fileAPath, fileAContent);
    fs.writeFileSync(fileBPath, fileBContent);
    
    console.log('📄 Created focused test files');
    
    // Look for file inputs
    let fileInputs = await page.locator('input[type="file"]').all();
    console.log(`📁 Found ${fileInputs.length} file input(s)`);
    
    if (fileInputs.length === 0) {
      // Look for upload buttons
      const uploadButton = page.locator('button').filter({ hasText: /upload|add.*file|browse/i }).first();
      if (await uploadButton.isVisible()) {
        console.log('📁 Clicking upload button...');
        await uploadButton.click();
        await page.waitForTimeout(1000);
        fileInputs = await page.locator('input[type="file"]').all();
      }
    }
    
    // Upload files if inputs are available
    if (fileInputs.length >= 1) {
      console.log('📁 Uploading File A...');
      await fileInputs[0].setInputFiles(fileAPath);
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'testing/screenshots/recon-focused-file-a.png', fullPage: true });
      
      // Check if more file inputs appeared or if we can upload second file
      const updatedFileInputs = await page.locator('input[type="file"]').all();
      if (updatedFileInputs.length >= 2) {
        console.log('📁 Uploading File B...');
        await updatedFileInputs[1].setInputFiles(fileBPath);
        await page.waitForTimeout(2000);
        
        await page.screenshot({ path: 'testing/screenshots/recon-focused-both-files.png', fullPage: true });
      }
      
      // Check what changed after file upload
      console.log('🔍 Analyzing UI changes after file upload...');
      
      // Look for newly enabled buttons
      const allButtons = await page.locator('button').all();
      let enabledButtons = 0;
      
      for (const button of allButtons) {
        try {
          const text = await button.textContent();
          const isEnabled = await button.isEnabled();
          const isVisible = await button.isVisible();
          
          if (isEnabled && isVisible && text) {
            enabledButtons++;
            console.log(`✅ Enabled button: "${text}"`);
            
            // If it looks like a process button, try clicking it
            if (text.toLowerCase().includes('process') || 
                text.toLowerCase().includes('run') || 
                text.toLowerCase().includes('start') ||
                text.toLowerCase().includes('reconcile')) {
              
              console.log(`▶️ Attempting to click: "${text}"`);
              try {
                await button.click();
                await page.waitForTimeout(3000); // Wait for processing
                
                await page.screenshot({ 
                  path: 'testing/screenshots/recon-focused-processing.png', 
                  fullPage: true 
                });
                
                console.log('✅ Process button clicked successfully');
                break;
              } catch (clickError) {
                console.log(`⚠️ Click failed: ${clickError.message}`);
              }
            }
          }
        } catch (error) {
          // Skip buttons that can't be analyzed
        }
      }
      
      console.log(`🔘 Total enabled buttons found: ${enabledButtons}`);
      
    } else {
      console.log('⚠️ No file inputs found - reconciliation may use different upload method');
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-focused-final.png', fullPage: true });
    
    console.log('✅ File upload test completed');
  });

  test('⚙️ Explore Configuration Options', async ({ page }) => {
    console.log('⚙️ TESTING: Configuration interface...');
    
    // Look for configuration-related elements
    const configSelectors = [
      'text=Configuration',
      'text=Settings',
      'text=Rules', 
      'text=Mapping',
      'button:has-text("Configure")',
      '[data-testid*="config"]'
    ];
    
    let configFound = false;
    for (const selector of configSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`⚙️ Found config element: ${selector}`);
          await element.click();
          await page.waitForTimeout(1000);
          
          await page.screenshot({ 
            path: `testing/screenshots/recon-config-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png`, 
            fullPage: true 
          });
          
          configFound = true;
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }
    
    if (!configFound) {
      console.log('⚠️ No configuration interface found');
    }
    
    // Look for form fields that might be configuration
    const formElements = await page.locator('select, input[type="text"], input[type="number"], textarea').all();
    console.log(`📝 Found ${formElements.length} form elements that might be configuration`);
    
    // Look for dropdown options
    const selects = await page.locator('select').all();
    for (let i = 0; i < Math.min(selects.length, 3); i++) {
      try {
        const select = selects[i];
        const options = await select.locator('option').all();
        console.log(`📋 Select ${i + 1}: ${options.length} options available`);
        
        if (options.length > 1) {
          // Try selecting different options to see what happens
          await select.selectOption({ index: 1 });
          await page.waitForTimeout(500);
        }
      } catch (error) {
        console.log(`⚠️ Could not interact with select ${i + 1}`);
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-config-exploration.png', fullPage: true });
    
    console.log('✅ Configuration exploration completed');
  });

  test('📊 Check Results and Data Display', async ({ page }) => {
    console.log('📊 TESTING: Results display capabilities...');
    
    // Look for any data that might already be displayed
    const dataSelectors = [
      'table',
      '.table',
      '[role="table"]',
      '.results',
      '.data-table',
      '.grid',
      'text=Results',
      'text=Matches',
      'text=Data'
    ];
    
    let dataFound = false;
    for (const selector of dataSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`📊 Found data display: ${selector} (${elements.length} elements)`);
          
          // Try to get some content from the data display
          const firstElement = elements[0];
          const content = await firstElement.textContent();
          if (content && content.length > 10) {
            console.log(`📄 Content preview: ${content.substring(0, 100)}...`);
            dataFound = true;
            
            await firstElement.screenshot({ 
              path: `testing/screenshots/recon-data-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png`
            });
          }
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }
    
    if (!dataFound) {
      console.log('⚠️ No existing data display found - may need files uploaded first');
    }
    
    // Look for export/download options
    const exportSelectors = [
      'button:has-text("Export")',
      'button:has-text("Download")', 
      'a:has-text("Download")',
      'text=Export',
      '[data-testid*="export"]'
    ];
    
    let exportFound = false;
    for (const selector of exportSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`💾 Found export option: ${selector}`);
          const isEnabled = await element.isEnabled();
          console.log(`   Status: ${isEnabled ? 'Enabled' : 'Disabled'}`);
          exportFound = true;
        }
      } catch (error) {
        // Continue checking
      }
    }
    
    if (!exportFound) {
      console.log('⚠️ No export functionality found');
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-results-check.png', fullPage: true });
    
    console.log('✅ Results display check completed');
  });

  test('🔍 Full UI Analysis', async ({ page }) => {
    console.log('🔍 ANALYZING: Complete reconciliation interface...');
    
    // Get comprehensive UI analysis
    const analysis = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      elements: {
        buttons: await page.locator('button').count(),
        inputs: await page.locator('input').count(),
        selects: await page.locator('select').count(),
        tables: await page.locator('table').count(),
        forms: await page.locator('form').count()
      },
      fileUpload: {
        fileInputs: await page.locator('input[type="file"]').count(),
        uploadButtons: await page.locator('button').filter({ hasText: /upload|browse/i }).count()
      },
      reconciliationFeatures: {
        configuration: await page.locator('text=Configuration').count() > 0,
        rules: await page.locator('text=Rules').count() > 0,
        mapping: await page.locator('text=Mapping').count() > 0,
        process: await page.locator('button').filter({ hasText: /process|run|reconcile/i }).count(),
        results: await page.locator('text=Results').count() > 0,
        export: await page.locator('button').filter({ hasText: /export|download/i }).count()
      }
    };
    
    console.log('🔍 UI ANALYSIS RESULTS:');
    console.log(`   Page: ${analysis.title}`);
    console.log(`   Elements: ${analysis.elements.buttons} buttons, ${analysis.elements.inputs} inputs`);
    console.log(`   File Upload: ${analysis.fileUpload.fileInputs} inputs, ${analysis.fileUpload.uploadButtons} buttons`);
    console.log(`   Features Available:`);
    Object.entries(analysis.reconciliationFeatures).forEach(([feature, available]) => {
      console.log(`     ${feature}: ${available ? '✅' : '❌'}`);
    });
    
    // Save analysis
    const reportDir = path.join(process.cwd(), 'testing', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const analysisPath = path.join(reportDir, 'reconciliation-ui-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    console.log(`📄 Analysis saved: ${analysisPath}`);
    
    // Take comprehensive screenshots of different UI states
    await page.screenshot({ path: 'testing/screenshots/recon-full-interface.png', fullPage: true });
    
    // Try to capture specific sections
    const sectionSelectors = ['.reconciliation', '.recon', '[data-testid*="recon"]'];
    for (const selector of sectionSelectors) {
      try {
        const section = page.locator(selector).first();
        if (await section.isVisible()) {
          console.log(`📸 Capturing section: ${selector}`);
          await section.screenshot({ 
            path: `testing/screenshots/recon-section-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png`
          });
        }
      } catch (error) {
        // Continue with other sections
      }
    }
    
    console.log('✅ Full UI analysis completed');
    console.log('📁 Check testing/screenshots/ for visual documentation');
    console.log('📄 Check testing/reports/ for detailed analysis');
  });
});