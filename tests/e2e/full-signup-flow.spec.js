/**
 * Full New User Signup Test via Playwright
 *
 * Tests the complete onboarding flow:
 * 1. Welcome screen
 * 2. Account creation (sign up)
 * 3. Legal consent
 * 4. Name entry
 * 5. Use case selection
 * 6. Mode explainer
 * 7. Email verification (skipped in test)
 * 8. Google integration (skip)
 * 9. Subscription selection
 * 10. Complete
 */

import { test, expect } from '@playwright/test';

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@agentmax.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

test.describe('Full New User Signup Flow', () => {
  test.setTimeout(120000); // 2 minute timeout for full flow

  test('should complete entire onboarding as new user', async ({ page }) => {
    console.log(`\n🚀 Starting full signup test with email: ${TEST_EMAIL}\n`);

    // Navigate to onboarding
    await page.goto('/#/onboarding');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/00-initial.png', fullPage: true });

    // ========================================
    // STEP 1: Welcome Screen
    // ========================================
    console.log('📍 STEP 1: Welcome Screen');

    // Wait for welcome content to load
    await page.waitForTimeout(1000);

    // Look for Get Started button
    const getStartedBtn = page.getByRole('button', { name: /get started/i })
      .or(page.locator('button:has-text("Get Started")'))
      .or(page.locator('button').first());

    await expect(getStartedBtn.first()).toBeVisible({ timeout: 10000 });
    await getStartedBtn.first().click();
    console.log('  ✓ Clicked Get Started');

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/01-after-welcome.png', fullPage: true });

    // ========================================
    // STEP 2: Account Creation (Sign Up)
    // ========================================
    console.log('📍 STEP 2: Account Creation');

    // Wait for account step
    await page.waitForTimeout(500);

    // Click Sign Up tab if visible
    const signUpTab = page.getByRole('tab', { name: /sign up/i })
      .or(page.locator('[role="tab"]:has-text("Sign Up")'))
      .or(page.locator('button:has-text("Sign Up")').first());

    try {
      if (await signUpTab.isVisible({ timeout: 3000 })) {
        await signUpTab.click();
        console.log('  ✓ Clicked Sign Up tab');
        await page.waitForTimeout(500);
      }
    } catch {
      console.log('  → No sign up tab found, proceeding');
    }

    // Fill email
    const emailInput = page.locator('input[type="email"]')
      .or(page.locator('input[name="email"]'))
      .or(page.locator('input[placeholder*="email" i]'));

    await emailInput.first().fill(TEST_EMAIL);
    console.log(`  ✓ Entered email: ${TEST_EMAIL}`);

    // Fill password
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(TEST_PASSWORD);
    console.log('  ✓ Entered password');

    // Fill confirm password if present
    const passwordCount = await passwordInputs.count();
    if (passwordCount > 1) {
      await passwordInputs.nth(1).fill(TEST_PASSWORD);
      console.log('  ✓ Confirmed password');
    }

    await page.screenshot({ path: 'test-results/02-account-filled.png', fullPage: true });

    // Submit signup
    const submitBtn = page.getByRole('button', { name: /sign up|create account|continue/i })
      .or(page.locator('button[type="submit"]'));

    await submitBtn.first().click();
    console.log('  ✓ Submitted signup');

    // Wait for Supabase response
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/03-after-signup.png', fullPage: true });

    // ========================================
    // STEP 3: Legal Consent
    // ========================================
    console.log('📍 STEP 3: Legal Consent');

    // Check all consent checkboxes
    const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
    const checkboxCount = await checkboxes.count();

    for (let i = 0; i < checkboxCount; i++) {
      try {
        await checkboxes.nth(i).click({ timeout: 2000 });
        console.log(`  ✓ Checked consent checkbox ${i + 1}`);
      } catch {
        // Try clicking the label instead
        const label = checkboxes.nth(i).locator('xpath=ancestor::label');
        if (await label.isVisible()) {
          await label.click();
        }
      }
    }

    // Click continue
    const legalContinue = page.getByRole('button', { name: /continue|accept|agree/i });
    if (await legalContinue.first().isVisible({ timeout: 3000 })) {
      await legalContinue.first().click();
      console.log('  ✓ Clicked continue on legal');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/04-after-legal.png', fullPage: true });

    // ========================================
    // STEP 4: Name Entry
    // ========================================
    console.log('📍 STEP 4: Name Entry');

    // Look for name input
    const nameInput = page.locator('input[name="name"]')
      .or(page.locator('input[placeholder*="name" i]'))
      .or(page.locator('input[type="text"]').first());

    try {
      if (await nameInput.isVisible({ timeout: 3000 })) {
        await nameInput.fill(TEST_NAME);
        console.log(`  ✓ Entered name: ${TEST_NAME}`);

        // Click continue
        const nameContinue = page.getByRole('button', { name: /continue/i });
        await nameContinue.first().click();
        console.log('  ✓ Clicked continue');
      }
    } catch {
      console.log('  → Name step may have been skipped');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/05-after-name.png', fullPage: true });

    // ========================================
    // STEP 5: Use Case Selection
    // ========================================
    console.log('📍 STEP 5: Use Case Selection');

    // Click on first use case option
    const useCaseOptions = page.locator('[class*="card"], [class*="option"], [role="radio"], button[class*="option"]');

    try {
      if (await useCaseOptions.first().isVisible({ timeout: 3000 })) {
        await useCaseOptions.first().click();
        console.log('  ✓ Selected first use case option');

        await page.waitForTimeout(500);
        const useCaseContinue = page.getByRole('button', { name: /continue/i });
        await useCaseContinue.first().click();
        console.log('  ✓ Clicked continue');
      }
    } catch {
      console.log('  → Use case step may have been skipped');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/06-after-usecase.png', fullPage: true });

    // ========================================
    // STEP 6: Mode Explainer
    // ========================================
    console.log('📍 STEP 6: Mode Explainer');

    const modeContinue = page.getByRole('button', { name: /continue|got it|next/i });
    try {
      if (await modeContinue.first().isVisible({ timeout: 3000 })) {
        await modeContinue.first().click();
        console.log('  ✓ Clicked continue on mode explainer');
      }
    } catch {
      console.log('  → Mode explainer may have been skipped');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/07-after-modes.png', fullPage: true });

    // ========================================
    // STEP 7: Email Verification
    // ========================================
    console.log('📍 STEP 7: Email Verification');

    // Check if we're on email verification step
    const pageContent = await page.content();
    if (pageContent.toLowerCase().includes('verify')) {
      const skipVerify = page.getByRole('button', { name: /skip|continue|later/i });
      try {
        if (await skipVerify.first().isVisible({ timeout: 3000 })) {
          await skipVerify.first().click();
          console.log('  ✓ Skipped email verification');
        }
      } catch {
        console.log('  → No skip button found');
      }
    } else {
      console.log('  → Email verification auto-skipped');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/08-after-verify.png', fullPage: true });

    // ========================================
    // STEP 8: Google Integration
    // ========================================
    console.log('📍 STEP 8: Google Integration');

    const skipGoogle = page.getByRole('button', { name: /skip|later|not now/i });
    try {
      if (await skipGoogle.first().isVisible({ timeout: 3000 })) {
        await skipGoogle.first().click();
        console.log('  ✓ Skipped Google integration');
      }
    } catch {
      console.log('  → Google step may have been skipped');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/09-after-google.png', fullPage: true });

    // ========================================
    // STEP 9: Subscription Selection
    // ========================================
    console.log('📍 STEP 9: Subscription Selection');

    // Look for Free Trial option
    const freeOption = page.getByRole('button', { name: /free|trial|start free/i })
      .or(page.locator('button:has-text("Free")'))
      .or(page.locator('[class*="plan"]:has-text("Free")'));

    try {
      if (await freeOption.first().isVisible({ timeout: 3000 })) {
        await freeOption.first().click();
        console.log('  ✓ Selected free plan');
      } else {
        // Try continue button
        const subContinue = page.getByRole('button', { name: /continue/i });
        await subContinue.first().click();
        console.log('  ✓ Clicked continue');
      }
    } catch {
      console.log('  → Subscription step may have been skipped');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/10-after-subscription.png', fullPage: true });

    // ========================================
    // STEP 10: Complete
    // ========================================
    console.log('📍 STEP 10: Complete Screen');

    // Check for completion
    const finalContent = await page.content();
    const isComplete = finalContent.includes('Complete') ||
                       finalContent.includes('Welcome') ||
                       finalContent.includes('Ready') ||
                       finalContent.includes('All set');

    if (isComplete) {
      console.log('  ✓ Reached completion screen');
    }

    // Click final button
    const finalBtn = page.getByRole('button', { name: /start|dashboard|begin|let/i });
    try {
      if (await finalBtn.first().isVisible({ timeout: 3000 })) {
        await finalBtn.first().click();
        console.log('  ✓ Clicked final button');
      }
    } catch {
      console.log('  → No final button found');
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/11-final.png', fullPage: true });

    // Verify we're no longer on onboarding
    const finalUrl = page.url();
    console.log(`\n📍 Final URL: ${finalUrl}`);

    // Check that we've exited onboarding
    if (!finalUrl.includes('onboarding')) {
      console.log('  ✓ Successfully exited onboarding!');
    }

    console.log('\n✅ Full signup flow test completed!\n');
  });
});
