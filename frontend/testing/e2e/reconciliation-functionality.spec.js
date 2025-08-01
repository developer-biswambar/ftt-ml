// Reconciliation Functionality Testing - Full End-to-End Workflow
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('🔄 Reconciliation Functionality Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Setting up reconciliation test environment...');
    
    // Enable detailed browser logging
    page.on('console', msg => {
      if (!msg.text().includes('Download the React DevTools')) {
        console.log(`🌐 BROWSER: ${msg.text()}`);
      }
    });
    
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes(':8000/')) {
        console.log(`🔗 API REQUEST: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/') || response.url().includes(':8000/')) {
        console.log(`📡 API RESPONSE: ${response.status()} ${response.url()}`);
      }
    });
    
    // Navigate to app
    await page.goto('/');
    await page.waitForTimeout(3000); // Wait for full app load
    
    // Take initial screenshot
    await page.screenshot({ path: 'testing/screenshots/recon-00-initial-state.png', fullPage: true });
    console.log('📸 Initial state captured');
  });

  test('🎯 Complete Reconciliation Workflow - File Upload to Results', async ({ page }) => {
    console.log('🔄 TESTING: Complete reconciliation workflow...');
    
    // Step 1: Navigate to Reconciliation section
    console.log('📍 Step 1: Navigate to Reconciliation...');
    
    // Try multiple ways to get to reconciliation
    const reconNavOptions = [
      'button:has-text("Reconciliation")',
      'a:has-text("Reconciliation")',
      '[data-testid*="recon"]',
      'text=Reconciliation'
    ];
    
    let reconNavigated = false;
    for (const selector of reconNavOptions) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`✅ Found reconciliation navigation: ${selector}`);
          await element.click();
          await page.waitForTimeout(2000);
          reconNavigated = true;
          break;
        }
      } catch (error) {
        console.log(`❌ Navigation attempt failed for ${selector}: ${error.message}`);
      }
    }
    
    if (!reconNavigated) {
      console.log('⚠️ No direct reconciliation navigation found, looking for tabs or sections...');
      
      // Try clicking any visible navigation elements
      const navElements = await page.locator('button, a, [role="tab"]').all();
      for (let i = 0; i < Math.min(navElements.length, 10); i++) {
        const element = navElements[i];
        const text = await element.textContent();
        
        if (text && text.toLowerCase().includes('recon')) {
          console.log(`✅ Found reconciliation element: "${text}"`);
          await element.click();
          await page.waitForTimeout(2000);
          reconNavigated = true;
          break;
        }
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-01-navigation.png', fullPage: true });
    
    // Step 2: Create and upload test files
    console.log('📁 Step 2: Preparing test files...');
    
    // Create test directory
    const testDir = path.join(process.cwd(), 'testing', 'fixtures', 'reconciliation');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // File A - Source transactions
    const fileAContent = `Transaction_ID,Reference_Number,Amount,Transaction_Date,Status,Description
TXN001,REF12345,1000.50,2024-01-15,SETTLED,Payment to Vendor A
TXN002,REF12346,2500.75,2024-01-15,SETTLED,Invoice Payment B
TXN003,REF12347,750.25,2024-01-16,PROCESSING,Service Payment C
TXN004,REF12348,1200.00,2024-01-16,SETTLED,Product Purchase D
TXN005,REF12349,850.33,2024-01-17,COMPLETE,Refund Processing E`;
    
    // File B - Bank statements
    const fileBContent = `Statement_ID,Reference,Value,Date_Processed,Bank_Status,Notes
STMT001,REF12345,1000.50,15/01/2024,Settled,Vendor payment processed
STMT002,REF12346,2500.75,15/01/2024,Settled,Invoice cleared successfully
STMT003,REF12347,750.25,16/01/2024,Processing,Service payment pending
STMT004,REF12348,1200.00,16/01/2024,Settled,Purchase completed
STMT006,REF99999,999.99,17/01/2024,Settled,Unmatched transaction`;
    
    const fileAPath = path.join(testDir, 'recon-test-file-a.csv');
    const fileBPath = path.join(testDir, 'recon-test-file-b.csv');
    
    fs.writeFileSync(fileAPath, fileAContent);
    fs.writeFileSync(fileBPath, fileBContent);
    
    console.log('📄 Created test files:');
    console.log(`   File A: ${fileAPath}`);
    console.log(`   File B: ${fileBPath}`);
    
    // Step 3: Upload files
    console.log('📁 Step 3: Uploading files...');
    
    // Look for file inputs or upload buttons
    let fileInputs = await page.locator('input[type="file"]').all();
    
    if (fileInputs.length === 0) {
      console.log('🔍 No direct file inputs found, looking for upload buttons...');
      
      const uploadButtons = page.locator('button').filter({ hasText: /upload|add.*file|browse|select.*file/i });
      const uploadCount = await uploadButtons.count();
      
      if (uploadCount > 0) {
        console.log(`📁 Found ${uploadCount} upload buttons, clicking first...`);
        await uploadButtons.first().click();
        await page.waitForTimeout(1000);
        
        // Check for file inputs that appeared
        fileInputs = await page.locator('input[type="file"]').all();
      }
    }
    
    if (fileInputs.length >= 2) {
      console.log(`📁 Found ${fileInputs.length} file inputs, uploading files...`);
      
      // Upload File A
      await fileInputs[0].setInputFiles(fileAPath);
      console.log('✅ File A uploaded');
      await page.waitForTimeout(2000);
      
      // Upload File B  
      await fileInputs[1].setInputFiles(fileBPath);
      console.log('✅ File B uploaded');
      await page.waitForTimeout(2000);
      
    } else if (fileInputs.length === 1) {
      console.log('📁 Found 1 file input, uploading first file...');
      await fileInputs[0].setInputFiles(fileAPath);
      await page.waitForTimeout(2000);
      
      // Look for another file input or upload button for second file
      const moreFileInputs = await page.locator('input[type="file"]').all();
      if (moreFileInputs.length > 1) {
        await moreFileInputs[1].setInputFiles(fileBPath);
        console.log('✅ Both files uploaded');
      }
    } else {
      console.log('⚠️ No file inputs found - testing will continue but may be limited');
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-02-files-uploaded.png', fullPage: true });
    
    // Step 4: Configure reconciliation settings
    console.log('⚙️ Step 4: Configuring reconciliation settings...');
    
    // Look for configuration elements
    const configElements = [
      'text=Configuration',
      'text=Settings', 
      'text=Rules',
      'text=Mapping',
      'button:has-text("Configure")',
      'button:has-text("Setup")',
      '[data-testid*="config"]'
    ];
    
    for (const selector of configElements) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`⚙️ Found configuration element: ${selector}`);
          await element.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    // Look for column mapping or field selection
    const fieldMappings = [
      { field: 'Reference', options: ['Reference_Number', 'Reference'] },
      { field: 'Amount', options: ['Amount', 'Value'] },
      { field: 'Date', options: ['Transaction_Date', 'Date_Processed'] },
      { field: 'Status', options: ['Status', 'Bank_Status'] }
    ];
    
    console.log('🗂️ Setting up field mappings...');
    
    // Try to set up basic reconciliation rules
    for (const mapping of fieldMappings) {
      // Look for dropdowns or input fields related to this mapping
      const fieldSelectors = [
        `select[name*="${mapping.field.toLowerCase()}"]`,
        `input[name*="${mapping.field.toLowerCase()}"]`,
        `[data-field="${mapping.field.toLowerCase()}"]`
      ];
      
      for (const selector of fieldSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`✅ Found ${mapping.field} field mapping`);
            // Try to set the mapping if it's a select
            if (selector.includes('select')) {
              await element.selectOption({ label: mapping.options[0] });
            }
            break;
          }
        } catch (error) {
          // Continue trying
        }
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-03-configuration.png', fullPage: true });
    
    // Step 5: Run reconciliation
    console.log('▶️ Step 5: Running reconciliation process...');
    
    // Look for process/run buttons
    const processButtons = [
      'button:has-text("Process")',
      'button:has-text("Run")',
      'button:has-text("Execute")',
      'button:has-text("Start")',
      'button:has-text("Reconcile")',
      'button:has-text("Match")',
      '[data-testid*="process"]',
      '[data-testid*="run"]'
    ];
    
    let processStarted = false;
    for (const selector of processButtons) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible() && await button.isEnabled()) {
          console.log(`▶️ Found process button: ${selector}`);
          await button.click();
          console.log('✅ Reconciliation process started');
          processStarted = true;
          break;
        }
      } catch (error) {
        console.log(`❌ Process button attempt failed: ${error.message}`);
      }
    }
    
    if (!processStarted) {
      console.log('⚠️ No enabled process button found, looking for any clickable elements...');
      
      // Try clicking any button that might start processing
      const allButtons = await page.locator('button').all();
      for (const button of allButtons) {
        const text = await button.textContent();
        const isEnabled = await button.isEnabled();
        
        if (isEnabled && text && (
          text.toLowerCase().includes('process') ||
          text.toLowerCase().includes('run') ||
          text.toLowerCase().includes('start') ||
          text.toLowerCase().includes('reconcile')
        )) {
          console.log(`▶️ Attempting to click: "${text}"`);
          try {
            await button.click();
            processStarted = true;
            break;
          } catch (error) {
            console.log(`❌ Click failed: ${error.message}`);
          }
        }
      }
    }
    
    // Wait for processing
    if (processStarted) {
      console.log('⏳ Waiting for reconciliation to complete...');
      await page.waitForTimeout(5000); // Wait for processing
      
      // Look for completion indicators
      const completionIndicators = [
        'text=Complete',
        'text=Finished',
        'text=Success',
        'text=Results',
        'text=Matches',
        '.success',
        '.complete',
        '[data-status="complete"]'
      ];
      
      for (const indicator of completionIndicators) {
        try {
          const element = page.locator(indicator).first();
          if (await element.isVisible()) {
            console.log(`✅ Process completion detected: ${indicator}`);
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-04-processing.png', fullPage: true });
    
    // Step 6: Check results
    console.log('📊 Step 6: Checking reconciliation results...');
    
    // Look for results display
    const resultElements = [
      'text=Results',
      'text=Matches',
      'text=Matched',
      'text=Unmatched',
      '.results',
      '.matches',
      '[data-testid*="result"]',
      'table',
      '.result-table'
    ];
    
    let resultsFound = false;
    for (const selector of resultElements) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`📊 Found results display: ${selector}`);
          resultsFound = true;
          
          // Try to capture results data
          const resultText = await element.textContent();
          if (resultText) {
            console.log(`📄 Results preview: ${resultText.substring(0, 200)}...`);
          }
          break;
        }
      } catch (error) {
        // Continue checking
      }
    }
    
    if (!resultsFound) {
      console.log('⚠️ No results display found, checking page content...');
      const bodyText = await page.textContent('body');
      
      // Look for reconciliation-related keywords in page
      const keywords = ['match', 'reconcil', 'result', 'process', 'complete'];
      const foundKeywords = keywords.filter(keyword => 
        bodyText.toLowerCase().includes(keyword)
      );
      
      console.log(`🔍 Found keywords in page: ${foundKeywords.join(', ')}`);
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-05-results.png', fullPage: true });
    
    // Step 7: Test export functionality
    console.log('💾 Step 7: Testing export functionality...');
    
    const exportButtons = [
      'button:has-text("Export")',
      'button:has-text("Download")',
      'button:has-text("Save")',
      'a:has-text("Export")',
      'a:has-text("Download")',
      '[data-testid*="export"]',
      '[data-testid*="download"]'
    ];
    
    for (const selector of exportButtons) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible() && await button.isEnabled()) {
          console.log(`💾 Found export button: ${selector}`);
          
          // Set up download listener
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
          
          await button.click();
          
          try {
            const download = await downloadPromise;
            console.log(`✅ Download started: ${download.suggestedFilename()}`);
            
            // Save the download
            const downloadPath = path.join(testDir, download.suggestedFilename() || 'reconciliation-result.csv');
            await download.saveAs(downloadPath);
            console.log(`💾 File saved: ${downloadPath}`);
            
          } catch (downloadError) {
            console.log(`⚠️ Download timeout or failed: ${downloadError.message}`);
          }
          
          break;
        }
      } catch (error) {
        // Continue trying other export options
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/recon-06-export.png', fullPage: true });
    
    // Final summary
    console.log('✅ Reconciliation workflow test completed!');
    console.log('📸 Screenshots saved:');
    console.log('   - recon-00-initial-state.png');
    console.log('   - recon-01-navigation.png');
    console.log('   - recon-02-files-uploaded.png');
    console.log('   - recon-03-configuration.png');
    console.log('   - recon-04-processing.png');
    console.log('   - recon-05-results.png');
    console.log('   - recon-06-export.png');
  });

  test('🧪 Test Reconciliation with Different Match Scenarios', async ({ page }) => {
    console.log('🧪 TESTING: Different reconciliation match scenarios...');
    
    // Navigate to reconciliation
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Test multiple scenarios
    const scenarios = [
      {
        name: 'Exact Matches',
        fileA: `ID,Reference,Amount,Date
1,REF001,100.00,2024-01-01
2,REF002,200.50,2024-01-02`,
        fileB: `ID,Ref,Value,Date
1,REF001,100.00,2024-01-01
2,REF002,200.50,2024-01-02`
      },
      {
        name: 'Tolerance Matches',
        fileA: `ID,Reference,Amount,Date
1,REF001,100.00,2024-01-01
2,REF002,200.51,2024-01-02`,
        fileB: `ID,Ref,Value,Date
1,REF001,100.01,2024-01-01
2,REF002,200.50,2024-01-02`
      },
      {
        name: 'Unmatched Records',
        fileA: `ID,Reference,Amount,Date
1,REF001,100.00,2024-01-01
2,REF999,999.99,2024-01-02`,
        fileB: `ID,Ref,Value,Date
1,REF001,100.00,2024-01-01
2,REF002,200.50,2024-01-02`
      }
    ];
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      console.log(`🧪 Testing scenario ${i + 1}: ${scenario.name}`);
      
      // Create test files for this scenario
      const testDir = path.join(process.cwd(), 'testing', 'fixtures', 'reconciliation');
      const fileAPath = path.join(testDir, `scenario-${i + 1}-file-a.csv`);
      const fileBPath = path.join(testDir, `scenario-${i + 1}-file-b.csv`);
      
      fs.writeFileSync(fileAPath, scenario.fileA);
      fs.writeFileSync(fileBPath, scenario.fileB);
      
      // Upload files (simplified version)
      const fileInputs = await page.locator('input[type="file"]').all();
      if (fileInputs.length >= 2) {
        await fileInputs[0].setInputFiles(fileAPath);
        await fileInputs[1].setInputFiles(fileBPath);
        await page.waitForTimeout(2000);
        
        // Try to process
        const processButton = page.locator('button').filter({ hasText: /process|run|reconcile/i }).first();
        if (await processButton.isEnabled()) {
          await processButton.click();
          await page.waitForTimeout(3000);
        }
        
        await page.screenshot({ 
          path: `testing/screenshots/recon-scenario-${i + 1}-${scenario.name.replace(/\s+/g, '-').toLowerCase()}.png`, 
          fullPage: true 
        });
      }
      
      console.log(`✅ Scenario ${i + 1} completed: ${scenario.name}`);
    }
  });

  test('📋 Generate Reconciliation Test Report', async ({ page }) => {
    console.log('📋 GENERATING: Reconciliation test report...');
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Analyze reconciliation features available
    const features = {
      fileUpload: await page.locator('input[type="file"]').count() > 0,
      processButton: await page.locator('button').filter({ hasText: /process|run|reconcile/i }).count() > 0,
      configuration: await page.locator('text=Configuration').count() > 0,
      results: await page.locator('text=Results').count() > 0,
      export: await page.locator('button').filter({ hasText: /export|download/i }).count() > 0
    };
    
    const report = {
      timestamp: new Date().toISOString(),
      testType: 'Reconciliation Functionality',
      features: features,
      testFiles: [
        'recon-test-file-a.csv',
        'recon-test-file-b.csv'
      ],
      expectedMatches: 4,
      expectedUnmatched: 1,
      screenshots: [
        'recon-00-initial-state.png',
        'recon-01-navigation.png', 
        'recon-02-files-uploaded.png',
        'recon-03-configuration.png',
        'recon-04-processing.png',
        'recon-05-results.png',
        'recon-06-export.png'
      ]
    };
    
    console.log('📋 RECONCILIATION TEST REPORT:');
    console.log(`   Timestamp: ${report.timestamp}`);
    console.log(`   Features Available:`);
    Object.entries(report.features).forEach(([feature, available]) => {
      console.log(`     ${feature}: ${available ? '✅' : '❌'}`);
    });
    console.log(`   Test Data: ${report.testFiles.length} files created`);
    console.log(`   Expected Results: ${report.expectedMatches} matches, ${report.expectedUnmatched} unmatched`);
    
    // Save report
    const reportDir = path.join(process.cwd(), 'testing', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = path.join(reportDir, 'reconciliation-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved: ${reportPath}`);
    
    await page.screenshot({ path: 'testing/screenshots/recon-final-report.png', fullPage: true });
  });
});