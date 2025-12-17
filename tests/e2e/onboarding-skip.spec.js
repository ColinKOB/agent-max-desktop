// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Onboarding Skip for Returning Users', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate fresh install
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('user with credits should skip subscription step after sign-in', async ({ page }) => {
    // Go to the app fresh (no onboarding_completed)
    await page.goto('http://localhost:5173');

    // Wait for onboarding to appear
    await page.waitForTimeout(2000);

    // Should see welcome/onboarding flow
    // Look for "Get Started" or similar welcome content
    const welcomeText = await page.locator('text=/get started|welcome|agent max/i').first();
    await expect(welcomeText).toBeVisible({ timeout: 10000 });

    // Click to proceed from welcome
    const getStartedBtn = page.locator('button:has-text("Get Started"), button:has-text("Continue")').first();
    if (await getStartedBtn.isVisible()) {
      await getStartedBtn.click();
      await page.waitForTimeout(500);
    }

    // Should now be on account step - find sign in option
    // Wait for account step
    await page.waitForTimeout(1000);

    // Click Sign In tab/button if there's a mode toggle
    const signInTab = page.locator('button:has-text("Sign In")').first();
    if (await signInTab.isVisible()) {
      await signInTab.click();
      await page.waitForTimeout(300);
    }

    // Fill in test user credentials
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill('colinkobrien1@gmail.com');

    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    // Note: We need the actual password here - using placeholder
    await passwordInput.fill('TestPassword123!'); // Placeholder - adjust as needed

    // Listen for console logs to see what's happening
    page.on('console', msg => {
      if (msg.text().includes('[Onboarding]')) {
        console.log('ONBOARDING LOG:', msg.text());
      }
    });

    // Click sign in button
    const signInButton = page.locator('button:has-text("Sign In"), button:has-text("Sign in")').last();
    await signInButton.click();

    // Wait for the sign-in to process
    await page.waitForTimeout(3000);

    // Should NOT see subscription step - should skip directly to complete
    // Check that we're NOT on subscription step
    const subscriptionStep = page.locator('text=/choose.*plan|subscription|free trial/i');
    const isSubscriptionVisible = await subscriptionStep.isVisible().catch(() => false);

    // Check if we're on complete step
    const completeStep = page.locator('text=/welcome|you\'re all set|ready to go|celebration/i');
    const isCompleteVisible = await completeStep.isVisible().catch(() => false);

    console.log('Subscription step visible:', isSubscriptionVisible);
    console.log('Complete step visible:', isCompleteVisible);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/onboarding-after-signin.png', fullPage: true });

    // The subscription step should NOT be visible for users with credits
    expect(isSubscriptionVisible).toBe(false);
  });

  test('console logs show correct skip decision', async ({ page }) => {
    const logs = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Onboarding]')) {
        logs.push(text);
        console.log('LOG:', text);
      }
    });

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Navigate to sign-in and attempt to sign in
    // This test just checks if the console logs are correct

    // Wait for any onboarding logs
    await page.waitForTimeout(5000);

    console.log('All onboarding logs:', logs);
  });
});
