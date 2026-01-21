/**
 * Stub Executor
 * 
 * Fake executor for Phase 1 testing. Returns fake success results
 * with simulated delay to mimic real execution.
 * 
 * Will be replaced with real Puppeteer executor in Phase 1 (Day 5-7)
 */

class StubExecutor {
  /**
   * Execute an action (fake implementation)
   */
  async execute(action, policy) {
    console.log('[StubExecutor] Executing:', action.type);
    console.log('[StubExecutor] Policy:', policy);
    
    // Simulate execution delay (500ms)
    await this._delay(500);
    
    // Generate fake result based on action type
    const result = await this._generateFakeResult(action, policy);
    
    console.log('[StubExecutor] Completed:', action.type, '✅');
    
    return {
      success: true,
      result
    };
  }

  /**
   * Generate fake result for action
   */
  async _generateFakeResult(action, policy) {
    const { type, args } = action;
    
    switch (type) {
      case 'browser.open':
        return {
          status: 'completed',
          evidence: {
            screenshot_b64: this._generateFakeScreenshot(),
            current_url: args.url,
            page_title: 'Fake Page Title'
          }
        };
      
      case 'browser.fill':
        return {
          status: 'completed',
          evidence: {
            screenshot_b64: this._generateFakeScreenshot(),
            dom_excerpt: `<input name="${args.selector}" value="${args.value}">`,
            element_found: true
          }
        };
      
      case 'browser.click':
        return {
          status: 'completed',
          evidence: {
            screenshot_b64: this._generateFakeScreenshot(),
            dom_excerpt: `<button>${args.selector}</button>`,
            element_clicked: true
          }
        };
      
      case 'desktop.screenshot':
      case 'screenshot':
        return {
          status: 'completed',
          evidence: {
            screenshot_b64: this._generateFakeScreenshot(),
            timestamp: new Date().toISOString()
          }
        };
      
      default:
        return {
          status: 'completed',
          message: `Fake execution of ${type}`
        };
    }
  }

  /**
   * Generate fake base64 screenshot
   */
  _generateFakeScreenshot() {
    // Return a tiny valid 1x1 PNG image in base64
    // This is just a placeholder - real screenshots will be much larger
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = StubExecutor;
