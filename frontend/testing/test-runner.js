// Comprehensive Test Runner - Run all UI tests in optimal order
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TestDataSetup } from './utils/test-data-setup.js';

class UITestRunner {
  constructor() {
    this.results = {
      smoke: null,
      workflows: null,
      performance: null,
      mobile: null,
      errors: []
    };
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Ensure test data exists
    await TestDataSetup.ensureTestFiles();
    await TestDataSetup.createMockFiles();
    
    // Ensure backend is running
    await this.checkBackendHealth();
    
    console.log('✅ Test environment ready');
  }

  async checkBackendHealth() {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (!response.ok) {
        throw new Error('Backend not responding');
      }
      console.log('✅ Backend is running');
    } catch (error) {
      console.error('❌ Backend is not running. Please start backend first:');
      console.error('   cd backend && python -m uvicorn app.main:app --reload');
      process.exit(1);
    }
  }

  async runSmokeTests() {
    console.log('🚀 Running smoke tests (quick verification)...');
    
    return new Promise((resolve) => {
      exec('npx playwright test testing/e2e/smoke-tests.spec.js --reporter=json', 
        (error, stdout, stderr) => {
          const result = {
            passed: !error,
            output: stdout,
            error: stderr,
            duration: null
          };
          
          if (error) {
            console.error('❌ Smoke tests failed');
            console.error(stderr);
          } else {
            console.log('✅ Smoke tests passed');
          }
          
          this.results.smoke = result;
          resolve(result);
        }
      );
    });
  }

  async runWorkflowTests() {
    console.log('🔄 Running complete workflow tests...');
    
    return new Promise((resolve) => {
      exec('npx playwright test testing/e2e/complete-workflow.spec.js --reporter=json --timeout=120000', 
        (error, stdout, stderr) => {
          const result = {
            passed: !error,
            output: stdout,
            error: stderr,
            duration: null
          };
          
          if (error) {
            console.error('❌ Workflow tests failed');
            console.error(stderr);
          } else {
            console.log('✅ Workflow tests passed');
          }
          
          this.results.workflows = result;
          resolve(result);
        }
      );
    });
  }

  async runPerformanceTests() {
    console.log('⚡ Running performance tests...');
    
    return new Promise((resolve) => {
      exec('npx playwright test testing/e2e/complete-workflow.spec.js --grep "Performance Testing" --reporter=json', 
        (error, stdout, stderr) => {
          const result = {
            passed: !error,
            output: stdout,
            error: stderr,
            duration: null
          };
          
          if (error) {
            console.error('⚠️ Performance tests had issues');
            console.error(stderr);
          } else {
            console.log('✅ Performance tests completed');
          }
          
          this.results.performance = result;
          resolve(result);
        }
      );
    });
  }

  async runMobileTests() {
    console.log('📱 Running mobile responsiveness tests...');
    
    return new Promise((resolve) => {
      exec('npx playwright test testing/e2e/complete-workflow.spec.js --grep "Mobile Responsiveness" --reporter=json', 
        (error, stdout, stderr) => {
          const result = {
            passed: !error,
            output: stdout,
            error: stderr,
            duration: null
          };
          
          if (error) {
            console.error('❌ Mobile tests failed');
            console.error(stderr);
          } else {
            console.log('✅ Mobile tests passed');
          }
          
          this.results.mobile = result;
          resolve(result);
        }
      );
    });
  }

  async runAllTests() {
    const startTime = Date.now();
    
    console.log('🎯 Starting comprehensive UI testing...');
    console.log('==========================================');
    
    try {
      await this.setup();
      
      // Run tests in optimal order
      await this.runSmokeTests();
      
      // Only continue if smoke tests pass
      if (this.results.smoke.passed) {
        await this.runWorkflowTests();
        await this.runPerformanceTests();
        await this.runMobileTests();
      } else {
        console.log('⚠️ Skipping remaining tests due to smoke test failures');
      }
      
    } catch (error) {
      console.error('❌ Test runner error:', error);
      this.results.errors.push(error.message);
    }
    
    const totalTime = Date.now() - startTime;
    await this.generateReport(totalTime);
  }

  async generateReport(totalTime) {
    console.log('\\n📊 Generating test report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: totalTime,
      summary: {
        smoke: this.results.smoke?.passed || false,
        workflows: this.results.workflows?.passed || false,
        performance: this.results.performance?.passed || false,
        mobile: this.results.mobile?.passed || false
      },
      details: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // Save report
    const reportPath = path.join(process.cwd(), 'testing', 'reports', 'ui-test-report.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('\\n🎯 UI TEST SUMMARY');
    console.log('===================');
    console.log(`⏱️  Total Time: ${Math.round(totalTime / 1000)}s`);
    console.log(`🚀 Smoke Tests: ${this.results.smoke?.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔄 Workflow Tests: ${this.results.workflows?.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`⚡ Performance Tests: ${this.results.performance?.passed ? '✅ PASS' : '⚠️ ISSUES'}`);
    console.log(`📱 Mobile Tests: ${this.results.mobile?.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (this.results.errors.length > 0) {
      console.log(`\\n❌ Errors encountered: ${this.results.errors.length}`);
      this.results.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log(`\\n📄 Full report saved: ${reportPath}`);
    
    // Generate recommendations
    console.log('\\n💡 RECOMMENDATIONS');
    console.log('===================');
    this.generateRecommendations().forEach(rec => console.log(`   ${rec}`));
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (!this.results.smoke?.passed) {
      recommendations.push('🔥 CRITICAL: Fix smoke test failures before proceeding');
      recommendations.push('   - Check if all core UI components are rendering');
      recommendations.push('   - Verify navigation and basic interactions work');
    }
    
    if (!this.results.workflows?.passed) {
      recommendations.push('⚠️ HIGH: Workflow tests failing - core functionality issues');
      recommendations.push('   - Check file upload functionality');
      recommendations.push('   - Verify API integrations are working');
      recommendations.push('   - Test AI assistance features');
    }
    
    if (!this.results.performance?.passed) {
      recommendations.push('⚡ MEDIUM: Performance issues detected');
      recommendations.push('   - Optimize large file handling');
      recommendations.push('   - Check for memory leaks');
      recommendations.push('   - Implement loading states');
    }
    
    if (!this.results.mobile?.passed) {
      recommendations.push('📱 MEDIUM: Mobile responsiveness issues');
      recommendations.push('   - Test on actual mobile devices');
      recommendations.push('   - Verify touch interactions work properly');
      recommendations.push('   - Check viewport scaling');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('🎉 All tests passing! UI is ready for production');
      recommendations.push('✅ Consider adding more edge case tests');
      recommendations.push('📈 Monitor real user interactions for further improvements');
    }
    
    return recommendations;
  }
}

// CLI Usage
if (process.argv.length > 2) {
  const runner = new UITestRunner();
  
  const command = process.argv[2];
  switch (command) {
    case 'smoke':
      runner.setup().then(() => runner.runSmokeTests());
      break;
    case 'workflows':
      runner.setup().then(() => runner.runWorkflowTests());
      break;
    case 'performance':
      runner.setup().then(() => runner.runPerformanceTests());
      break;
    case 'mobile':
      runner.setup().then(() => runner.runMobileTests());
      break;
    case 'all':
    default:
      runner.runAllTests();
      break;
  }
} else {
  console.log('Usage: node testing/test-runner.js [smoke|workflows|performance|mobile|all]');
}

export { UITestRunner };