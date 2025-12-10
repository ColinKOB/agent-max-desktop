const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 420, height: 680 }
  });
  
  const page = await context.newPage();
  
  // Try the onboarding preview page directly
  await page.goto('http://localhost:5173/#/onboarding-preview');
  await page.waitForTimeout(2000);
  
  // Take screenshot of welcome
  await page.screenshot({ path: '/tmp/onboarding-welcome.png' });
  
  // Click Get Started
  try {
    const btn = await page.locator('button:has-text("Get Started")');
    await btn.click({ timeout: 3000 });
    await page.waitForTimeout(1000);
    
    // Screenshot of legal step
    await page.screenshot({ path: '/tmp/legal-step-screenshot.png' });
    console.log('Legal step screenshot saved!');
  } catch (e) {
    console.log('Button click failed:', e.message);
    // Try alternative - look for any button with arrow
    try {
      await page.locator('button >> nth=0').click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/legal-step-screenshot.png' });
    } catch (e2) {
      console.log('Alternative also failed');
    }
  }
  
  await browser.close();
})();
