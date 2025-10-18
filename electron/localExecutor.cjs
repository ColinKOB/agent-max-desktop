/**
 * Local Executor - Real Browser Control with Puppeteer
 * 
 * Executes actions using real Puppeteer browser automation.
 * This replaces stubExecutor.cjs for production use.
 * 
 * Capabilities:
 * - Real browser control
 * - Screenshot capture
 * - Form filling
 * - Navigation
 * - Element clicking
 */

const puppeteer = require('puppeteer');

class LocalExecutor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.initialized = false;
  }

  /**
   * Initialize browser
   */
  async init() {
    if (this.initialized) {
      console.log('[LocalExecutor] Already initialized');
      return;
    }

    console.log('[LocalExecutor] Initializing Puppeteer...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        defaultViewport: {
          width: 1280,
          height: 720
        }
      });
      
      this.page = await this.browser.newPage();
      this.initialized = true;
      
      console.log('[LocalExecutor] Browser initialized ✅');
    } catch (error) {
      console.error('[LocalExecutor] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Execute an action
   */
  async execute(action, policy) {
    console.log('[LocalExecutor] Executing:', action.type);
    
    // Ensure browser is initialized
    if (!this.initialized) {
      await this.init();
    }

    const { type, args } = action;

    try {
      let result;

      switch (type) {
        case 'browser.open':
          result = await this.browserOpen(args);
          break;
        
        case 'browser.fill':
          result = await this.browserFill(args);
          break;
        
        case 'browser.click':
          result = await this.browserClick(args);
          break;
        
        case 'screenshot':
          result = await this.screenshot(args);
          break;
        
        case 'browser.get_text':
          result = await this.browserGetText(args);
          break;
        
        default:
          throw new Error(`Unknown action type: ${type}`);
      }

      console.log('[LocalExecutor] Completed:', type, '✅');
      
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('[LocalExecutor] Error:', type, error.message);
      
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Open URL in browser
   */
  async browserOpen(args) {
    const { url } = args;
    
    console.log('[LocalExecutor] Opening:', url);
    
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Take screenshot as evidence
    const screenshotB64 = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        current_url: this.page.url(),
        page_title: await this.page.title()
      }
    };
  }

  /**
   * Fill input field
   */
  async browserFill(args) {
    const { selector, value } = args;
    
    console.log('[LocalExecutor] Filling:', selector, 'with:', value);
    
    // Wait for element
    await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Clear and fill
    await this.page.click(selector, { clickCount: 3 }); // Select all
    await this.page.type(selector, value);
    
    // Take screenshot as evidence
    const screenshotB64 = await this.page.screenshot({ encoding: 'base64' });
    
    // Get element HTML as confirmation
    const elementHTML = await this.page.$eval(selector, el => el.outerHTML);
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        dom_excerpt: elementHTML,
        element_found: true,
        value_filled: value
      }
    };
  }

  /**
   * Click element
   */
  async browserClick(args) {
    const { selector } = args;
    
    console.log('[LocalExecutor] Clicking:', selector);
    
    // Wait for element
    await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Click
    await this.page.click(selector);
    
    // Wait a bit for page to respond
    await this.page.waitForTimeout(1000);
    
    // Take screenshot as evidence
    const screenshotB64 = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        element_clicked: true,
        current_url: this.page.url()
      }
    };
  }

  /**
   * Get text from element
   */
  async browserGetText(args) {
    const { selector } = args;
    
    console.log('[LocalExecutor] Getting text from:', selector);
    
    // Wait for element
    await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Get text
    const text = await this.page.$eval(selector, el => el.textContent);
    
    return {
      status: 'completed',
      text: text.trim(),
      selector
    };
  }

  /**
   * Take screenshot
   */
  async screenshot(args) {
    console.log('[LocalExecutor] Taking screenshot');
    
    const screenshotB64 = await this.page.screenshot({
      encoding: 'base64',
      fullPage: args.fullPage || false
    });
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        timestamp: new Date().toISOString(),
        url: this.page.url()
      }
    };
  }

  /**
   * Cleanup - close browser
   */
  async close() {
    if (this.browser) {
      console.log('[LocalExecutor] Closing browser');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.initialized = false;
    }
  }
}

module.exports = LocalExecutor;
