/**
 * Simple test to verify Puppeteer executor works
 */

const LocalExecutor = require('./electron/localExecutor.cjs');

async function testPuppeteer() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Puppeteer Executor');
  console.log('='.repeat(60));
  
  const executor = new LocalExecutor();
  
  try {
    // Test 1: browser.open
    console.log('\n🧪 Test 1: browser.open');
    const result1 = await executor.execute(
      {
        type: 'browser.open',
        args: { url: 'https://www.google.com' }
      },
      { timeout_ms: 30000 }
    );
    
    if (result1.success) {
      console.log('✅ Browser opened successfully');
      console.log(`   URL: ${result1.result.evidence.current_url}`);
      console.log(`   Title: ${result1.result.evidence.page_title}`);
      console.log(`   Screenshot: ${result1.result.evidence.screenshot_b64.length} bytes`);
    } else {
      console.log('❌ Browser open failed:', result1.error);
      return false;
    }
    
    // Test 2: screenshot
    console.log('\n🧪 Test 2: screenshot');
    const result2 = await executor.execute(
      {
        type: 'screenshot',
        args: {}
      },
      { timeout_ms: 5000 }
    );
    
    if (result2.success) {
      console.log('✅ Screenshot captured');
      console.log(`   Screenshot: ${result2.result.evidence.screenshot_b64.length} bytes`);
    } else {
      console.log('❌ Screenshot failed:', result2.error);
      return false;
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await executor.close();
    console.log('✅ Browser closed');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All Puppeteer tests PASSED!');
    console.log('='.repeat(60));
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    try {
      await executor.close();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

// Run test
testPuppeteer().then(success => {
  process.exit(success ? 0 : 1);
});
