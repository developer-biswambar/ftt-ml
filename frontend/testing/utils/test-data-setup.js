// Test Data Setup Utilities
import fs from 'fs';
import path from 'path';

export class TestDataSetup {
  static async ensureTestFiles() {
    const fixturesDir = path.join(process.cwd(), 'testing', 'fixtures');
    
    // Ensure fixtures directory exists
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Copy test files from backend docs/testing
    const sourceFiles = [
      'recon_file_a.csv',
      'recon_file_b.csv', 
      'comprehensive_test_file_a.csv',
      'comprehensive_test_file_b.csv',
      'source_customer_data.csv',
      'source_transaction_data.csv',
      'source_product_data.csv'
    ];

    for (const file of sourceFiles) {
      const sourcePath = path.join(process.cwd(), '..', 'backend', 'docs', 'testing', 'reconciliation', file);
      const destPath = path.join(fixturesDir, file);
      
      if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  static async createMockFiles() {
    const fixturesDir = path.join(process.cwd(), 'testing', 'fixtures');
    
    // Create invalid file for error testing
    const invalidFile = path.join(fixturesDir, 'invalid.txt');
    if (!fs.existsSync(invalidFile)) {
      fs.writeFileSync(invalidFile, 'This is not a CSV file');
    }

    // Create large file for performance testing (if doesn't exist)
    const largeFile = path.join(fixturesDir, 'large_file.csv');
    if (!fs.existsSync(largeFile)) {
      let csvContent = 'ID,Name,Value,Date\\n';
      for (let i = 1; i <= 10000; i++) {
        csvContent += `${i},Item${i},${Math.random() * 1000},2024-01-${(i % 30) + 1}\\n`;
      }
      fs.writeFileSync(largeFile, csvContent);
    }

    // Create delta test files
    const deltaOld = path.join(fixturesDir, 'delta_file_old.csv');
    const deltaNew = path.join(fixturesDir, 'delta_file_new.csv');
    
    if (!fs.existsSync(deltaOld)) {
      const oldData = `ID,Name,Amount,Status
1,Item A,100.00,Active
2,Item B,200.00,Active
3,Item C,300.00,Inactive
4,Item D,400.00,Active`;
      fs.writeFileSync(deltaOld, oldData);
    }

    if (!fs.existsSync(deltaNew)) {
      const newData = `ID,Name,Amount,Status
1,Item A,100.00,Active
2,Item B Modified,250.00,Active
4,Item D,400.00,Inactive
5,Item E,500.00,Active`;
      fs.writeFileSync(deltaNew, newData);
    }
  }

  static getTestScenarios() {
    return {
      reconciliation: {
        basic: {
          name: 'Basic Reference Matching',
          fileA: 'recon_file_a.csv',
          fileB: 'recon_file_b.csv',
          expectedMatches: 10,
          aiPrompt: 'Match transactions by reference number only'
        },
        comprehensive: {
          name: 'Multi-Rule Reconciliation',
          fileA: 'comprehensive_test_file_a.csv',
          fileB: 'comprehensive_test_file_b.csv',
          expectedMatches: 20,
          aiPrompt: 'Match by reference, amount tolerance 0.01, and date'
        }
      },
      transformation: {
        basic: {
          name: 'Customer Data Mapping',
          files: ['source_customer_data.csv'],
          expectedOutputRows: 20,
          aiPrompt: 'Create customer summary with full name and tier classification'
        },
        complex: {
          name: 'Multi-File Join',
          files: ['source_customer_data.csv', 'source_transaction_data.csv'],
          expectedOutputRows: 25,
          aiPrompt: 'Join customer and transaction data for sales analysis'
        }
      },
      delta: {
        basic: {
          name: 'File Comparison',
          oldFile: 'delta_file_old.csv',
          newFile: 'delta_file_new.csv',
          expectedNew: 1,
          expectedModified: 2,
          expectedDeleted: 1,
          expectedUnchanged: 1
        }
      }
    };
  }

  static async uploadFileToUI(page, filePath, uploadSelector = 'input[type="file"]') {
    const fullPath = path.join(process.cwd(), 'testing', 'fixtures', filePath);
    await page.setInputFiles(uploadSelector, fullPath);
  }

  static async waitForProcessing(page, timeout = 60000) {
    // Wait for processing to start
    await page.waitForSelector('[data-testid="processing-indicator"]', { timeout: 5000 });
    
    // Wait for processing to complete
    await page.waitForSelector('[data-testid="processing-complete"]', { timeout });
  }

  static async verifyResults(page, expectedType, expectedCount) {
    const selector = `[data-testid="${expectedType}-count"]`;
    await page.waitForSelector(selector);
    
    const actualCount = await page.textContent(selector);
    const count = parseInt(actualCount);
    
    if (expectedCount !== null) {
      if (count !== expectedCount) {
        throw new Error(`Expected ${expectedCount} ${expectedType}, got ${count}`);
      }
    } else {
      if (count <= 0) {
        throw new Error(`Expected positive ${expectedType} count, got ${count}`);
      }
    }
    
    return count;
  }

  static async captureScreenshot(page, name) {
    const screenshotPath = path.join(process.cwd(), 'testing', 'screenshots', `${name}.png`);
    const screenshotDir = path.dirname(screenshotPath);
    
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  static async measurePerformance(page, operation) {
    const startTime = Date.now();
    
    await operation();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Performance: ${operation.name || 'Operation'} took ${duration}ms`);
    return duration;
  }

  static async mockAPIErrors(page, endpoints = []) {
    for (const endpoint of endpoints) {
      await page.route(`**/api/${endpoint}/**`, route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Mocked API Error', message: 'This is a test error' })
        });
      });
    }
  }

  static async mockSlowAPI(page, endpoints = [], delay = 2000) {
    for (const endpoint of endpoints) {
      await page.route(`**/api/${endpoint}/**`, async route => {
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.continue();
      });
    }
  }
}