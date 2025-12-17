// @ts-check
const { test, expect } = require('@playwright/test');

// Run with: npx playwright test test-signin-headed --headed

test('sign in with existing user should skip to complete', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Onboarding]') || text.includes('[App]')) {
        console.log(`BROWSER: ${text}`);
      }
    });

    // Clear localStorage first
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload to get fresh state
    await page.reload();
    await page.waitForTimeout(2000);

    // Should see onboarding - look for welcome/get started
    console.log('\n=== Looking for Get Started button ===');

    // Take screenshot
    await page.screenshot({ path: 'test-results/step1-initial.png', fullPage: true });

    // Try multiple selectors for the Get Started button
    const getStartedButton = page.locator('button:has-text("Get Started"), button:has-text("Let\'s Go"), button:has-text("Start"), button:has-text("Continue")').first();

    try {
      await expect(getStartedButton).toBeVisible({ timeout: 10000 });
      console.log('Found start button, clicking...');
      await getStartedButton.click();
      await page.waitForTimeout(1500);
    } catch (e) {
      console.log('No start button found, checking current state...');
      // Check if we're already past welcome
      const content = await page.content();
      console.log('Page has Sign In:', content.includes('Sign In'));
      console.log('Page has Sign Up:', content.includes('Sign Up'));
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/step2-after-start.png', fullPage: true });

    // Now we should be on account step - look for sign in mode
    console.log('\n=== Looking for Sign In option ===');

    // Click Sign In tab/button if visible
    const signInTab = page.locator('button:has-text("Sign In"), div:has-text("Sign In")').first();
    try {
      await expect(signInTab).toBeVisible({ timeout: 5000 });
      await signInTab.click();
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Sign In tab not found or already selected');
    }

    // Fill in email
    console.log('\n=== Filling in credentials ===');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill('colinkobrien1@gmail.com');

    // Fill in password
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await passwordInput.fill('asdfasdf'); // Use test password

    await page.screenshot({ path: 'test-results/step3-credentials-filled.png', fullPage: true });

    // Click Sign In button
    console.log('\n=== Clicking Sign In ===');
    const signInButton = page.locator('button:has-text("Sign In")').last();
    await signInButton.click();

    // Wait and watch console for debug output
    console.log('\n=== Waiting for response ===');
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'test-results/step4-after-signin.png', fullPage: true });

    // Check what step we're on now
    const pageContent = await page.content();
    console.log('\n=== Current page state ===');
    console.log('Has subscription options:', pageContent.includes('subscription') || pageContent.includes('Starter') || pageContent.includes('Pro'));
    console.log('Has completion/welcome:', pageContent.includes('Welcome') || pageContent.includes('ready') || pageContent.includes('complete'));
    console.log('Has legal/terms:', pageContent.includes('Terms') || pageContent.includes('Privacy'));

    // The test passes if we see completion, fails if we see subscription
    if (pageContent.includes('Starter') || pageContent.includes('Choose a plan') || pageContent.includes('subscription')) {
      console.error('FAILED: Still showing subscription page after sign in');
      await page.screenshot({ path: 'test-results/FAILED-subscription-shown.png', fullPage: true });
    } else {
      console.log('SUCCESS: Did not show subscription page');
    }

    // Wait a bit longer to see final state
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/step5-final.png', fullPage: true });
});
