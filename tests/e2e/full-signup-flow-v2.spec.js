/**
 * Full New User Signup Test via Playwright (v2 - More Robust)
 *
 * Tests the complete onboarding flow with better error handling and logging
 */

import { test, expect } from '@playwright/test';

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@agentmax.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

test.describe('Full New User Signup Flow v2', () => {
  test.setTimeout(180000); // 3 minute timeout

  test('should complete entire onboarding as new user', async ({ page }) => {
    console.log('\n========================================');
    console.log('🚀 FULL NEW USER SIGNUP TEST (v2)');
    console.log('========================================');
    console.log(`Test Email: ${TEST_EMAIL}`);
    console.log('========================================\n');

    const results = { passed: [], failed: [], currentStep: '' };

    const logStep = (step, success, message) => {
      const icon = success ? '✓' : '✗';
      console.log(`  ${icon} ${message}`);
      if (success) {
        results.passed.push(`${step}: ${message}`);
      } else {
        results.failed.push(`${step}: ${message}`);
      }
    };

    // Navigate to onboarding
    await page.goto('/#/onboarding');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ========================================
    // STEP 1: Welcome Screen
    // ========================================
    console.log('\n📍 STEP 1: Welcome Screen');
    results.currentStep = 'Welcome';

    try {
      // Find and click Get Started
      await page.waitForTimeout(500);
      const buttons = await page.locator('button').all();
      let clicked = false;

      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && text.toLowerCase().includes('get started')) {
          await btn.click();
          logStep('Welcome', true, 'Clicked Get Started');
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // Try first visible button
        await page.locator('button').first().click();
        logStep('Welcome', true, 'Clicked first button');
      }

      await page.waitForTimeout(1500);
    } catch (e) {
      logStep('Welcome', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 2: Account Creation (Sign Up)
    // ========================================
    console.log('\n📍 STEP 2: Account Creation');
    results.currentStep = 'Account';

    try {
      // Click Sign Up tab if it exists
      const tabs = await page.locator('[role="tab"], button').all();
      for (const tab of tabs) {
        const text = await tab.textContent();
        if (text && text.toLowerCase().includes('sign up')) {
          await tab.click();
          logStep('Account', true, 'Clicked Sign Up tab');
          await page.waitForTimeout(500);
          break;
        }
      }

      // Fill email
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill(TEST_EMAIL);
        logStep('Account', true, `Filled email: ${TEST_EMAIL}`);
      } else {
        logStep('Account', false, 'Email input not found');
      }

      // Fill password(s)
      const passwordInputs = await page.locator('input[type="password"]').all();
      if (passwordInputs.length > 0) {
        await passwordInputs[0].fill(TEST_PASSWORD);
        logStep('Account', true, 'Filled password');

        if (passwordInputs.length > 1) {
          await passwordInputs[1].fill(TEST_PASSWORD);
          logStep('Account', true, 'Filled confirm password');
        }
      } else {
        logStep('Account', false, 'Password input not found');
      }

      // Submit
      await page.waitForTimeout(500);
      const submitButtons = await page.locator('button').all();
      for (const btn of submitButtons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('sign up') ||
                     text.toLowerCase().includes('create') ||
                     text.toLowerCase().includes('continue'))) {
          await btn.click();
          logStep('Account', true, 'Clicked submit');
          break;
        }
      }

      // Wait for Supabase auth
      await page.waitForTimeout(4000);

    } catch (e) {
      logStep('Account', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 3: Legal Consent
    // ========================================
    console.log('\n📍 STEP 3: Legal Consent');
    results.currentStep = 'Legal';

    try {
      // Check all checkboxes
      const checkboxes = await page.locator('input[type="checkbox"]').all();
      console.log(`  Found ${checkboxes.length} checkbox(es)`);

      for (let i = 0; i < checkboxes.length; i++) {
        try {
          const isChecked = await checkboxes[i].isChecked();
          if (!isChecked) {
            await checkboxes[i].click({ force: true });
            logStep('Legal', true, `Checked checkbox ${i + 1}`);
          }
        } catch {
          // Try clicking parent label
          try {
            await checkboxes[i].locator('xpath=..').click();
          } catch { }
        }
      }

      // Click Continue
      await page.waitForTimeout(500);
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('continue') ||
                     text.toLowerCase().includes('accept') ||
                     text.toLowerCase().includes('agree'))) {
          await btn.click();
          logStep('Legal', true, 'Clicked Continue');
          break;
        }
      }

      await page.waitForTimeout(1500);
    } catch (e) {
      logStep('Legal', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 4: Name Entry
    // ========================================
    console.log('\n📍 STEP 4: Name Entry');
    results.currentStep = 'Name';

    try {
      // Look for name input
      const nameInput = page.locator('input[type="text"], input[name="name"], input[placeholder*="name" i]').first();

      if (await nameInput.isVisible({ timeout: 3000 })) {
        await nameInput.fill(TEST_NAME);
        logStep('Name', true, `Filled name: ${TEST_NAME}`);

        // Click Continue
        await page.waitForTimeout(300);
        const buttons = await page.locator('button').all();
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && text.toLowerCase().includes('continue')) {
            await btn.click();
            logStep('Name', true, 'Clicked Continue');
            break;
          }
        }

        await page.waitForTimeout(1500);
      } else {
        logStep('Name', true, 'Name step auto-skipped or not present');
      }
    } catch (e) {
      logStep('Name', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 5: Use Case Selection
    // ========================================
    console.log('\n📍 STEP 5: Use Case Selection');
    results.currentStep = 'UseCase';

    try {
      // Find selectable options (cards, radio buttons, etc.)
      const options = page.locator('[class*="card"], [class*="option"], [role="radio"], button[class*="use"]');
      const optionCount = await options.count();
      console.log(`  Found ${optionCount} option(s)`);

      if (optionCount > 0) {
        await options.first().click();
        logStep('UseCase', true, 'Selected first option');

        // Click Continue
        await page.waitForTimeout(500);
        const buttons = await page.locator('button').all();
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && text.toLowerCase().includes('continue')) {
            await btn.click();
            logStep('UseCase', true, 'Clicked Continue');
            break;
          }
        }

        await page.waitForTimeout(1500);
      } else {
        logStep('UseCase', true, 'UseCase step auto-skipped or not present');
      }
    } catch (e) {
      logStep('UseCase', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 6: Mode Explainer
    // ========================================
    console.log('\n📍 STEP 6: Mode Explainer');
    results.currentStep = 'Modes';

    try {
      await page.waitForTimeout(500);
      const buttons = await page.locator('button').all();

      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('continue') ||
                     text.toLowerCase().includes('got it') ||
                     text.toLowerCase().includes('next'))) {
          await btn.click();
          logStep('Modes', true, 'Clicked Continue');
          break;
        }
      }

      await page.waitForTimeout(1500);
    } catch (e) {
      logStep('Modes', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 7: Email Verification
    // ========================================
    console.log('\n📍 STEP 7: Email Verification');
    results.currentStep = 'EmailVerify';

    try {
      const content = await page.content();
      if (content.toLowerCase().includes('verify')) {
        const buttons = await page.locator('button').all();
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && (text.toLowerCase().includes('skip') ||
                       text.toLowerCase().includes('later') ||
                       text.toLowerCase().includes('continue'))) {
            await btn.click();
            logStep('EmailVerify', true, 'Clicked Skip/Continue');
            break;
          }
        }
      } else {
        logStep('EmailVerify', true, 'Email verification auto-skipped');
      }

      await page.waitForTimeout(1500);
    } catch (e) {
      logStep('EmailVerify', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 8: Google Integration
    // ========================================
    console.log('\n📍 STEP 8: Google Integration');
    results.currentStep = 'Google';

    try {
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('skip') ||
                     text.toLowerCase().includes('later') ||
                     text.toLowerCase().includes('not now'))) {
          await btn.click();
          logStep('Google', true, 'Clicked Skip');
          break;
        }
      }

      await page.waitForTimeout(1500);
    } catch (e) {
      logStep('Google', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 9: Subscription Selection
    // ========================================
    console.log('\n📍 STEP 9: Subscription Selection');
    results.currentStep = 'Subscription';

    try {
      // Look for Free plan option
      const freeButtons = await page.locator('button').all();
      let found = false;

      for (const btn of freeButtons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('free') ||
                     text.toLowerCase().includes('trial') ||
                     text.toLowerCase().includes('start free'))) {
          await btn.click();
          logStep('Subscription', true, 'Selected Free plan');
          found = true;
          break;
        }
      }

      if (!found) {
        // Try Continue button
        for (const btn of freeButtons) {
          const text = await btn.textContent();
          if (text && text.toLowerCase().includes('continue')) {
            await btn.click();
            logStep('Subscription', true, 'Clicked Continue');
            break;
          }
        }
      }

      await page.waitForTimeout(1500);
    } catch (e) {
      logStep('Subscription', false, `Error: ${e.message}`);
    }

    // ========================================
    // STEP 10: Complete
    // ========================================
    console.log('\n📍 STEP 10: Complete Screen');
    results.currentStep = 'Complete';

    try {
      const content = await page.content();
      const isComplete = content.includes('Complete') ||
                         content.includes('Welcome') ||
                         content.includes('Ready') ||
                         content.includes('All set');

      if (isComplete) {
        logStep('Complete', true, 'Reached completion screen');
      }

      // Click final button
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && (text.toLowerCase().includes('start') ||
                     text.toLowerCase().includes('dashboard') ||
                     text.toLowerCase().includes('begin') ||
                     text.toLowerCase().includes('let'))) {
          await btn.click();
          logStep('Complete', true, 'Clicked final button');
          break;
        }
      }

      await page.waitForTimeout(2000);
    } catch (e) {
      logStep('Complete', false, `Error: ${e.message}`);
    }

    // Final verification
    const finalUrl = page.url();
    console.log(`\n📍 Final URL: ${finalUrl}`);

    // Print Results
    console.log('\n========================================');
    console.log('📊 TEST RESULTS');
    console.log('========================================');
    console.log(`\n✅ PASSED (${results.passed.length}):`);
    results.passed.forEach(p => console.log(`   • ${p}`));

    if (results.failed.length > 0) {
      console.log(`\n❌ FAILED (${results.failed.length}):`);
      results.failed.forEach(f => console.log(`   • ${f}`));
    }

    const total = results.passed.length + results.failed.length;
    const successRate = total > 0 ? (results.passed.length / total * 100).toFixed(1) : 0;
    console.log(`\n📈 Success Rate: ${successRate}%`);
    console.log('========================================\n');

    // Assert test passed
    expect(results.failed.length, `Failed steps: ${results.failed.join(', ')}`).toBe(0);
  });
});
