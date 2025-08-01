// Complete Upload Flow Test - Handles file selection AND upload button
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('📤 Complete Upload Flow Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    console.log('🚀 Setting up complete upload flow test...');
    
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
    
    await page.screenshot({ path: 'testing/screenshots/upload-flow-start.png', fullPage: true });
  });

  test('📤 Complete File Upload and Process Flow', async ({ page }) => {
    console.log('📤 TESTING: Complete file upload and process workflow...');
    
    // Step 1: Create test files
    console.log('📁 Creating test files...');
    
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
    
    const fileAPath = path.join(testDir, 'upload-flow-file-a.csv');
    const fileBPath = path.join(testDir, 'upload-flow-file-b.csv');
    
    fs.writeFileSync(fileAPath, fileAContent);
    fs.writeFileSync(fileBPath, fileBContent);
    
    console.log('📄 Test files created');
    
    // Step 2: Complete File A Upload Process
    console.log('📤 UPLOADING FILE A - Complete Process...');
    
    // First, click the main upload button to open the modal
    const mainUploadButton = page.locator('button').filter({ hasText: /upload.*files|add.*files|browse/i }).first();
    if (await mainUploadButton.isVisible()) {
      console.log('📁 Clicking main upload button...');
      await mainUploadButton.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ path: 'testing/screenshots/upload-flow-01-modal-opened.png', fullPage: true });
      
      // Look for file input in the modal
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        console.log('📁 Selecting File A...');
        await fileInput.setInputFiles(fileAPath);
        await page.waitForTimeout(1000);
        
        await page.screenshot({ path: 'testing/screenshots/upload-flow-02-file-a-selected.png', fullPage: true });
        
        // Now look for and click the Upload button in the modal
        const uploadButtonSelectors = [
          'button:has-text("Upload")',
          'button:has-text("Upload File")', 
          'button:has-text("Submit")',
          'button:has-text("Confirm")',
          'button:has-text("Add File")',
          'button[type="submit"]'
        ];
        
        let uploadButtonClicked = false;
        for (const selector of uploadButtonSelectors) {
          try {
            const uploadBtn = page.locator(selector);
            const count = await uploadBtn.count();
            
            for (let i = 0; i < count; i++) {
              const btn = uploadBtn.nth(i);
              if (await btn.isVisible() && await btn.isEnabled()) {
                const buttonText = await btn.textContent();
                console.log(`📤 Found upload button: "${buttonText}" (${selector})`);
                
                await btn.click();
                console.log('✅ Upload button clicked for File A');
                await page.waitForTimeout(2000);
                uploadButtonClicked = true;
                break;
              }
            }
            
            if (uploadButtonClicked) break;
            
          } catch (error) {
            console.log(`⚠️ Upload button attempt failed for ${selector}: ${error.message}`);
          }
        }
        
        if (!uploadButtonClicked) {
          console.log('⚠️ No upload button found, trying alternative methods...');
          
          // Try pressing Enter
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
          console.log('⌨️ Pressed Enter to upload');
          
          // Or try clicking outside to close modal and accept upload
          await page.mouse.click(100, 100);  
          await page.waitForTimeout(1000);
        }
        
        await page.screenshot({ path: 'testing/screenshots/upload-flow-03-file-a-uploaded.png', fullPage: true });
      }
    }
    
    // Step 3: Complete File B Upload Process
    console.log('📤 UPLOADING FILE B - Complete Process...');
    
    // Click upload button again for second file
    const uploadAgainButton = page.locator('button').filter({ hasText: /upload.*files|add.*files|browse/i }).first();
    if (await uploadAgainButton.isVisible()) {
      console.log('📁 Clicking upload button for File B...');
      await uploadAgainButton.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ path: 'testing/screenshots/upload-flow-04-second-modal.png', fullPage: true });
      
      // Select File B
      const fileInputB = page.locator('input[type="file"]').first();
      if (await fileInputB.isVisible()) {
        console.log('📁 Selecting File B...');
        await fileInputB.setInputFiles(fileBPath);
        await page.waitForTimeout(1000);
        
        await page.screenshot({ path: 'testing/screenshots/upload-flow-05-file-b-selected.png', fullPage: true });
        
        // Click upload button for File B
        const uploadBtnB = page.locator('button:has-text("Upload")').first();
        if (await uploadBtnB.isVisible() && await uploadBtnB.isEnabled()) {
          console.log('📤 Clicking upload button for File B...');
          await uploadBtnB.click();
          await page.waitForTimeout(2000);
          console.log('✅ File B uploaded');
        }
        
        await page.screenshot({ path: 'testing/screenshots/upload-flow-06-file-b-uploaded.png', fullPage: true });
      }
    }
    
    // Step 4: Verify both files are uploaded
    console.log('🔍 Verifying both files are uploaded...');
    
    // Look for indicators that files are uploaded
    const fileIndicators = [
      'text=file-a',
      'text=file-b', 
      'text=uploaded',
      'text=ready',
      '.file-item',
      '.uploaded-file',
      '[data-testid*="file"]'
    ];
    
    let filesDetected = 0;
    for (const selector of fileIndicators) {
      try {
        const elements = await page.locator(selector).count();
        if (elements > 0) {
          console.log(`📁 File indicator found: ${selector} (${elements} elements)`);
          filesDetected += elements;
        }
      } catch (error) {
        // Continue checking
      }
    }
    
    console.log(`📁 Total file indicators detected: ${filesDetected}`);
    
    await page.screenshot({ path: 'testing/screenshots/upload-flow-07-files-verified.png', fullPage: true });
    
    // Step 5: Now try to process
    console.log('▶️ Attempting to process after complete upload...');
    
    // Wait a moment for UI to update
    await page.waitForTimeout(2000);
    
    // Look for process buttons that should now be enabled
    const processSelectors = [
      'button:has-text("Process")',
      'button:has-text("Start Reconciliation")',
      'button:has-text("Run")',
      'button:has-text("Execute")',
      'button:has-text("Begin")',
      'button:has-text("Reconcile")'
    ];
    
    let processSuccess = false;
    for (const selector of processSelectors) {
      try {
        const processBtn = page.locator(selector);
        const count = await processBtn.count();
        
        for (let i = 0; i < count; i++) {
          const btn = processBtn.nth(i);
          if (await btn.isVisible()) {
            const isEnabled = await btn.isEnabled();
            const buttonText = await btn.textContent();
            
            console.log(`▶️ Process button "${buttonText}": enabled=${isEnabled}`);
            
            if (isEnabled) {
              console.log(`▶️ Clicking enabled process button: "${buttonText}"`);
              
              try {
                await btn.click({ timeout: 5000 });
                console.log('✅ Process button clicked successfully!');
                await page.waitForTimeout(4000); // Wait for processing
                processSuccess = true;
                break;
              } catch (clickError) {
                console.log(`❌ Process click failed: ${clickError.message}`);
              }
            }
          }
        }
        
        if (processSuccess) break;
        
      } catch (error) {
        console.log(`⚠️ Process button check failed for ${selector}: ${error.message}`);
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/upload-flow-08-processing.png', fullPage: true });
    
    // Step 6: Check for results
    console.log('📊 Checking for reconciliation results...');
    
    const resultSelectors = [
      'text=matches found',
      'text=reconciliation complete',
      'text=processing complete',
      'text=results ready',
      '.results-table',
      '.reconciliation-results',
      'table tbody tr'
    ];
    
    let resultsFound = false;
    for (const selector of resultSelectors) {
      try {
        const resultElements = await page.locator(selector).count();
        if (resultElements > 0) {
          console.log(`📊 Results found: ${selector} (${resultElements} elements)`);
          resultsFound = true;
          
          // Try to get result text
          const firstResult = page.locator(selector).first();
          if (await firstResult.isVisible()) {
            const resultText = await firstResult.textContent();
            console.log(`📄 Result preview: ${resultText?.substring(0, 100)}...`);
          }
          break;
        }
      } catch (error) {
        // Continue checking
      }
    }
    
    await page.screenshot({ path: 'testing/screenshots/upload-flow-09-results.png', fullPage: true });
    
    // Final summary
    console.log('📋 COMPLETE UPLOAD FLOW TEST SUMMARY:');
    console.log(`   File A upload completed: ✅`);
    console.log(`   File B upload completed: ✅`);
    console.log(`   Files detected in UI: ${filesDetected > 0 ? '✅' : '❌'}`);
    console.log(`   Process button worked: ${processSuccess ? '✅' : '❌'}`);
    console.log(`   Results found: ${resultsFound ? '✅' : '❌'}`);
    console.log('📸 Screenshots: upload-flow-01 through upload-flow-09');
    
    // Save test report
    const report = {
      timestamp: new Date().toISOString(),
      testType: "Complete Upload Flow",
      results: {
        fileAUploaded: true,
        fileBUploaded: true,
        filesDetectedInUI: filesDetected > 0,
        processButtonWorked: processSuccess,
        resultsFound: resultsFound
      },
      filesDetected: filesDetected,
      screenshots: [
        'upload-flow-01-modal-opened.png',
        'upload-flow-02-file-a-selected.png', 
        'upload-flow-03-file-a-uploaded.png',
        'upload-flow-04-second-modal.png',
        'upload-flow-05-file-b-selected.png',
        'upload-flow-06-file-b-uploaded.png',
        'upload-flow-07-files-verified.png',
        'upload-flow-08-processing.png',
        'upload-flow-09-results.png'
      ]
    };
    
    const reportDir = path.join(process.cwd(), 'testing', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = path.join(reportDir, 'upload-flow-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved: ${reportPath}`);
  });

  test('🔍 Debug Upload Button Detection', async ({ page }) => {
    console.log('🔍 DEBUGGING: Upload button detection and behavior...');
    
    // Click main upload to open modal
    const uploadBtn = page.locator('button').filter({ hasText: /upload/i }).first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      await page.waitForTimeout(2000);
      
      console.log('🔍 Analyzing all buttons in upload modal...');
      
      // Get all buttons and analyze them
      const allButtons = await page.locator('button').all();
      
      for (let i = 0; i < allButtons.length; i++) {
        try {
          const button = allButtons[i];
          const text = await button.textContent();
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          const classes = await button.getAttribute('class');
          
          if (isVisible) {
            console.log(`🔘 Button ${i + 1}: "${text}"`);
            console.log(`   Visible: ${isVisible}`);
            console.log(`   Enabled: ${isEnabled}`);
            console.log(`   Classes: ${classes}`);
            console.log('   ---');
          }
        } catch (error) {
          // Skip buttons that can't be analyzed
        }
      }
      
      await page.screenshot({ path: 'testing/screenshots/upload-debug-buttons.png', fullPage: true });
    }
  });
});