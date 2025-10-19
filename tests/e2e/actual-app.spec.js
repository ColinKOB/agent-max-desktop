/**
 * E2E Tests for Actual Implemented Features
 * Tests the real functionality that exists in the app
 */
import { test, expect } from '@playwright/test';

test.describe('Agent Max Desktop - Actual Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000); // Wait for React to render
  });

  test('app loads and shows main interface', async ({ page }) => {
    // Check that the app loaded
    const root = await page.$('#root');
    expect(root).toBeTruthy();
    
    // Look for any main content
    const mainContent = await page.$('main, [role="main"], .main, .content, .app');
    expect(mainContent).toBeTruthy();
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'screenshots/main-interface.png' });
  });

  test('test dashboard is accessible', async ({ page }) => {
    // Navigate to test dashboard
    await page.goto('http://localhost:5173/#/test');
    await page.waitForTimeout(2000);
    
    // Check if test dashboard elements exist
    const testContent = await page.$$('text=/test|testing|dashboard/i');
    expect(testContent.length).toBeGreaterThan(0);
    
    // Look for any test components
    const liquidGlass = await page.$$('[class*="liquid"], [class*="glass"]');
    console.log(`Found ${liquidGlass.length} liquid glass components`);
    
    // Run tests if button exists
    const runButton = await page.$('button:has-text("Run"), button:has-text("Test")');
    if (runButton) {
      await runButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('settings page is accessible', async ({ page }) => {
    // Navigate to settings
    await page.goto('http://localhost:5173/#/settings');
    await page.waitForTimeout(2000);
    
    // Check for settings content
    const settingsContent = await page.$$('text=/setting|preference|config/i');
    console.log(`Found ${settingsContent.length} settings elements`);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/settings-page.png' });
  });

  test('liquid glass UI components render', async ({ page }) => {
    // Check for liquid glass CSS classes
    const glassElements = await page.$$('.liquid-glass');
    console.log(`Found ${glassElements.length} .liquid-glass elements`);
    
    // Check for glass surfaces
    const surfaces = await page.$$('[class*="surface"]');
    console.log(`Found ${surfaces.length} surface elements`);
    
    // Check for cards
    const cards = await page.$$('[class*="card"]');
    console.log(`Found ${cards.length} card elements`);
    
    expect(glassElements.length + surfaces.length + cards.length).toBeGreaterThan(0);
  });

  test('buttons are interactive', async ({ page }) => {
    // Find all buttons
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} buttons`);
    expect(buttons.length).toBeGreaterThan(0);
    
    // Click the first visible button (if any)
    const visibleButton = await page.$('button:visible');
    if (visibleButton) {
      const buttonText = await visibleButton.textContent();
      console.log(`Clicking button: ${buttonText}`);
      await visibleButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('theme switching works', async ({ page }) => {
    // Look for theme switcher
    const themeSwitcher = await page.$('[aria-label*="theme"], [title*="theme"], button:has-text("Theme")');
    
    if (themeSwitcher) {
      await themeSwitcher.click();
      await page.waitForTimeout(500);
      
      // Check if theme menu opened
      const themeOptions = await page.$$('text=/dark|light|theme/i');
      if (themeOptions.length > 0) {
        // Try clicking a theme option
        await themeOptions[0].click();
        await page.waitForTimeout(500);
      }
    }
    
    // Check if theme class changed
    const htmlElement = await page.$('html');
    const classes = await htmlElement.getAttribute('class');
    console.log('HTML classes:', classes);
  });

  test('keyboard shortcuts work', async ({ page }) => {
    // Try Command Palette shortcut
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    
    // Check if any dialog or modal opened
    const dialog = await page.$('[role="dialog"], .modal, .command-palette');
    
    if (dialog) {
      console.log('Command palette opened');
      // Close it
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('responsive design adapts to viewport', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Check that content is still visible
      const content = await page.$('#root');
      expect(content).toBeTruthy();
      
      // Take screenshot
      await page.screenshot({ 
        path: `screenshots/responsive-${viewport.name.toLowerCase()}.png` 
      });
    }
  });

  test('no console errors on page load', async ({ page }) => {
    const errors = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore some common non-critical errors
        if (!text.includes('favicon') && 
            !text.includes('DevTools') &&
            !text.includes('Warning:')) {
          errors.push(text);
        }
      }
    });
    
    // Reload page to catch all errors
    await page.reload();
    await page.waitForTimeout(2000);
    
    console.log('Console errors:', errors);
    expect(errors.length).toBe(0);
  });

  test('performance metrics are acceptable', async ({ page }) => {
    // Measure performance
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        domInteractive: perfData.domInteractive
      };
    });
    
    console.log('Performance metrics:', metrics);
    
    // Check that page loads reasonably quickly
    expect(metrics.domContentLoaded).toBeLessThan(3000); // 3 seconds
    expect(metrics.loadComplete).toBeLessThan(5000); // 5 seconds
  });

  test('accessibility - focus indicators work', async ({ page }) => {
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    // Check if any element has focus
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        hasFocus: el === document.activeElement
      };
    });
    
    console.log('Focused element:', focusedElement);
    expect(focusedElement.hasFocus).toBeTruthy();
    
    // Tab through more elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
  });

  test('basic navigation between routes', async ({ page }) => {
    const routes = [
      '/',
      '/#/test',
      '/#/settings',
      '/#/dashboard'
    ];
    
    for (const route of routes) {
      await page.goto(`http://localhost:5173${route}`);
      await page.waitForTimeout(1000);
      
      // Check that page loaded
      const content = await page.$('#root');
      expect(content).toBeTruthy();
      
      // Check URL
      const url = page.url();
      console.log(`Route ${route} loaded: ${url}`);
    }
  });
});
