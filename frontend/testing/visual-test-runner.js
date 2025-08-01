// Visual Test Runner - Shows exactly what's happening during tests
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

class VisualTestRunner {
  constructor() {
    this.logColors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'
    };
  }

  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const color = this.logColors[level] || this.logColors.info;
    console.log(`${color}[${timestamp}] ${message}${this.logColors.reset}`);
  }

  async setupScreenshotDir() {
    const screenshotDir = path.join(process.cwd(), 'testing', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Clear old screenshots
    const files = fs.readdirSync(screenshotDir);
    files.forEach(file => {
      if (file.endsWith('.png') || file.endsWith('.jpg')) {
        fs.unlinkSync(path.join(screenshotDir, file));
      }
    });
    
    this.log('info', `📁 Screenshot directory prepared: ${screenshotDir}`);
  }

  async checkServices() {
    this.log('info', '🔍 Checking required services...');
    
    // Check backend
    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        this.log('success', '✅ Backend is running on port 8000');
      } else {
        throw new Error('Backend not responding');
      }
    } catch (error) {
      this.log('error', '❌ Backend not running! Start with: cd backend && python -m uvicorn app.main:app --reload');
      return false;
    }

    // Check frontend
    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) {
        this.log('success', '✅ Frontend is running on port 5173');
      } else {
        throw new Error('Frontend not responding');
      }
    } catch (error) {
      this.log('error', '❌ Frontend not running! Start with: npm run dev');
      return false;
    }

    return true;
  }

  async runVisualDemo() {
    this.log('info', '🎬 Starting Visual UI Testing Demo...');
    this.log('info', '👁️  Browser will open and you can watch the tests run');
    this.log('info', '📸 Screenshots will be saved to testing/screenshots/');
    
    await this.setupScreenshotDir();
    
    if (!await this.checkServices()) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Run the visual demo test
      const testProcess = spawn('npx', [
        'playwright', 
        'test', 
        'testing/e2e/visual-demo.spec.js',
        '--headed',
        '--reporter=line',
        '--timeout=60000'
      ], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      testProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.log('info', `🎭 PLAYWRIGHT: ${output}`);
        }
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output && !output.includes('Warning')) {
          this.log('warning', `⚠️  ${output}`);
        }
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          this.log('success', '✅ Visual tests completed successfully!');
          this.showScreenshots();
        } else {
          this.log('error', `❌ Tests failed with code ${code}`);
        }
        resolve(code);
      });

      testProcess.on('error', (error) => {
        this.log('error', `❌ Test process error: ${error.message}`);
        reject(error);
      });
    });
  }

  async runInteractiveMode() {
    this.log('info', '🎮 Starting Interactive Test Mode...');
    this.log('info', '🎯 You can control test execution and see real-time results');
    
    if (!await this.checkServices()) {
      return;
    }

    return new Promise((resolve) => {
      const testProcess = spawn('npx', [
        'playwright', 
        'test',
        '--ui',
        '--timeout=120000'
      ], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      testProcess.on('close', (code) => {
        this.log('info', `🎮 Interactive mode closed with code ${code}`);
        resolve(code);
      });
    });
  }

  async runStepByStep() {
    this.log('info', '👣 Starting Step-by-Step Test Mode...');
    this.log('info', '⏸️  Tests will pause between steps so you can observe');
    
    await this.setupScreenshotDir();
    
    if (!await this.checkServices()) {
      return;
    }

    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', [
        'playwright', 
        'test', 
        'testing/e2e/visual-demo.spec.js',
        '--headed',
        '--debug',
        '--timeout=0'  // No timeout for debug mode
      ], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      testProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.log('info', `🔍 DEBUG: ${output}`);
        }
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.log('warning', `⚠️  ${output}`);
        }
      });

      testProcess.on('close', (code) => {
        this.log('info', `👣 Step-by-step testing completed with code ${code}`);
        this.showScreenshots();
        resolve(code);
      });

      testProcess.on('error', (error) => {
        this.log('error', `❌ Debug process error: ${error.message}`);
        reject(error);
      });
    });
  }

  showScreenshots() {
    const screenshotDir = path.join(process.cwd(), 'testing', 'screenshots');
    
    if (fs.existsSync(screenshotDir)) {
      const screenshots = fs.readdirSync(screenshotDir)
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg'))
        .sort();
      
      if (screenshots.length > 0) {
        this.log('success', `📸 ${screenshots.length} screenshots captured:`);
        screenshots.forEach((screenshot, index) => {
          this.log('info', `   ${index + 1}. ${screenshot}`);
        });
        this.log('info', `📁 Location: ${screenshotDir}`);
      } else {
        this.log('warning', '📸 No screenshots were captured');
      }
    }
  }

  showHelp() {
    console.log(`
🎬 Visual UI Test Runner

Usage: node testing/visual-test-runner.js [mode]

Modes:
  demo        🎭 Run visual demo (watch tests execute)
  interactive 🎮 Interactive test runner with UI
  debug       👣 Step-by-step debugging mode
  help        ❓ Show this help message

Examples:
  node testing/visual-test-runner.js demo
  node testing/visual-test-runner.js interactive
  node testing/visual-test-runner.js debug

Prerequisites:
  ✅ Backend running: cd backend && python -m uvicorn app.main:app --reload
  ✅ Frontend running: npm run dev

Features:
  👁️  Watch browser execute tests in real-time
  📸 Automatic screenshot capture
  🔍 Detailed console logging
  ⏸️  Step-by-step execution with pauses
  🎮 Interactive test control panel
    `);
  }
}

// CLI Usage
const runner = new VisualTestRunner();
const mode = process.argv[2] || 'demo';

switch (mode) {
  case 'demo':
    runner.runVisualDemo();
    break;
  case 'interactive':
    runner.runInteractiveMode();
    break;
  case 'debug':
    runner.runStepByStep();
    break;
  case 'help':
  default:
    runner.showHelp();
    break;
}

export { VisualTestRunner };