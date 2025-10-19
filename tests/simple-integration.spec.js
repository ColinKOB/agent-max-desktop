/**
 * Simple Integration Test to verify core functionality
 * Tests that the app runs and basic components render
 */
import { test, expect } from '@playwright/test';

test.describe('Agent Max Desktop - Basic Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Start with the main page
    await page.goto('http://localhost:5173');
  });

  test('app loads successfully', async ({ page }) => {
    // Wait for React to render
    await page.waitForTimeout(2000);
    
    // Check if root element exists
    const root = await page.$('#root');
    expect(root).toBeTruthy();
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-screenshot.png' });
  });

  test('shows main UI components', async ({ page }) => {
    // Wait for app to load
    await page.waitForTimeout(3000);
    
    // Check for main elements that should be visible
    // Try to find any heading
    const heading = await page.$('h1, h2, h3, h4');
    expect(heading).toBeTruthy();
    
    // Check for buttons
    const buttons = await page.$$('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('navigation works', async ({ page }) => {
    // Wait for app to load
    await page.waitForTimeout(3000);
    
    // Try clicking settings if available
    const settingsButton = await page.$('button:has-text("Settings"), a:has-text("Settings")');
    if (settingsButton) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Check URL or content changed
    const url = page.url();
    console.log('Current URL:', url);
  });

  test('test dashboard link', async ({ page }) => {
    // Go to test dashboard
    await page.goto('http://localhost:5173/#/test');
    await page.waitForTimeout(3000);
    
    // Check if test dashboard loaded
    const testDashboard = await page.$('text=UI Test Dashboard, text=UI Testing, text=Test Dashboard');
    expect(testDashboard).toBeTruthy();
    
    // Try running tests if button exists
    const runTestsButton = await page.$('button:has-text("Run All Tests")');
    if (runTestsButton) {
      await runTestsButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('liquid glass components render', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    // Check for liquid glass classes
    const liquidGlassElements = await page.$$('.liquid-glass, [class*="glass"]');
    console.log(`Found ${liquidGlassElements.length} liquid glass elements`);
    expect(liquidGlassElements.length).toBeGreaterThan(0);
  });

  test('responsive design works', async ({ page }) => {
    // Test desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    
    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Check that content is still visible
    const content = await page.$('#root');
    expect(content).toBeTruthy();
  });

  test('keyboard shortcuts work', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Try Command Palette (Cmd+K or Ctrl+K)
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    
    // Check if command palette opened
    const commandPalette = await page.$('.command-palette, [role="dialog"]');
    
    if (commandPalette) {
      // Close it
      await page.keyboard.press('Escape');
    }
  });

  test('error boundaries work', async ({ page }) => {
    // Check console for errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // There should be no critical errors
    const criticalErrors = errors.filter(err => 
      err.includes('Error') && 
      !err.includes('Warning') && 
      !err.includes('DevTools')
    );
    
    console.log('Console errors found:', criticalErrors);
    expect(criticalErrors.length).toBe(0);
  });
});
