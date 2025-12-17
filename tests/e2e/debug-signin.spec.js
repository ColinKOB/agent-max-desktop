// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Debug Sign-In Flow', () => {
  test('test sign-in directly on account step', async ({ page }) => {
    const logs = [];

    // Capture ALL console logs
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`BROWSER: ${text}`);
    });

    // Capture page errors
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
    });

    // Go directly to account step using hash route
    console.log('\n=== Going to onboarding preview - account step ===');
    await page.goto('http://localhost:5173/#/onboarding-preview?step=1');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/direct-account-step.png', fullPage: true });

    // Log what we see
    const html = await page.content();
    console.log('\nPage contains email input:', html.includes('type="email"') || html.includes('placeholder'));
    console.log('Page contains Sign In:', html.includes('Sign In'));
    console.log('Page contains Sign Up:', html.includes('Sign Up'));

    // Try to find any input
    const inputs = await page.locator('input').all();
    console.log(`\nFound ${inputs.length} input elements`);

    // Try to find any button
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} button elements`);

    // Print ALL onboarding logs
    console.log('\n=== ALL ONBOARDING LOGS ===');
    const onboardingLogs = logs.filter(l => l.includes('[Onboarding]') || l.includes('[App]'));
    onboardingLogs.forEach(l => console.log(l));
  });
});
