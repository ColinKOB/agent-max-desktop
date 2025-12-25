/**
 * Full New User Signup Debug Test
 *
 * Captures all console logs and network errors for debugging
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = `newuser-${Date.now()}@agentmax.test`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Signup Debug Test', () => {
  test.setTimeout(120000);

  test('should create new user and capture all logs', async ({ page }) => {
    const consoleLogs = [];
    const networkErrors = [];
    const networkRequests = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text });
      if (text.includes('[Onboarding]') || text.includes('error') || text.includes('Error')) {
        console.log(`[CONSOLE ${msg.type()}] ${text}`);
      }
    });

    // Capture network errors
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
      console.log(`[NETWORK ERROR] ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Capture Supabase auth requests
    page.on('response', response => {
      const url = response.url();
      if (url.includes('supabase') || url.includes('auth')) {
        networkRequests.push({
          url: url,
          status: response.status(),
          statusText: response.statusText()
        });
        if (response.status() >= 400) {
          console.log(`[NETWORK ${response.status()}] ${url}`);
        }
      }
    });

    console.log('\n========================================');
    console.log('🔍 SIGNUP DEBUG TEST');
    console.log('========================================');
    console.log(`Test Email: ${TEST_EMAIL}`);
    console.log('========================================\n');

    // Navigate to onboarding
    await page.goto('/#/onboarding');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('📍 STEP 1: Welcome Screen');

    // Click Get Started
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.toLowerCase().includes('get started')) {
        await btn.click();
        console.log('  ✓ Clicked Get Started');
        break;
      }
    }
    await page.waitForTimeout(1500);

    console.log('\n📍 STEP 2: Account Creation');

    // Find Sign Up tab
    const tabs = await page.locator('[role="tab"], button').all();
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text && text.toLowerCase().includes('sign up')) {
        await tab.click();
        console.log('  ✓ Clicked Sign Up tab');
        await page.waitForTimeout(500);
        break;
      }
    }

    // Fill email
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(TEST_EMAIL);
    console.log(`  ✓ Email: ${TEST_EMAIL}`);

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);
    console.log('  ✓ Password filled');

    // Wait a moment for form validation
    await page.waitForTimeout(500);

    // Look at the page state before clicking
    const pageHTML = await page.content();
    const hasError = pageHTML.toLowerCase().includes('error');
    console.log(`  Page has error messages before submit: ${hasError}`);

    // Find and click Sign Up button
    console.log('\n  Looking for submit button...');
    const allButtons = await page.locator('button').all();
    let submitClicked = false;

    for (const btn of allButtons) {
      const text = await btn.textContent();
      const isDisabled = await btn.isDisabled();
      console.log(`    Button: "${text?.trim()}" - disabled: ${isDisabled}`);

      if (text && !isDisabled &&
          (text.toLowerCase().includes('sign up') ||
           text.toLowerCase().includes('create account'))) {
        console.log(`  → Clicking: "${text?.trim()}"`);
        await btn.click();
        submitClicked = true;
        break;
      }
    }

    if (!submitClicked) {
      // Try form submit
      const form = page.locator('form').first();
      if (await form.isVisible({ timeout: 1000 })) {
        console.log('  → Submitting form directly');
        await form.evaluate(f => f.submit());
        submitClicked = true;
      }
    }

    console.log(`  Submit clicked: ${submitClicked}`);

    // Wait for auth request to complete
    console.log('\n  Waiting for auth response...');
    await page.waitForTimeout(5000);

    // Check for any errors on page
    const errorElements = await page.locator('[class*="error"], [class*="Error"], [role="alert"]').all();
    console.log(`  Error elements found: ${errorElements.length}`);

    for (const el of errorElements) {
      const text = await el.textContent();
      if (text) {
        console.log(`  ❌ Error: ${text}`);
      }
    }

    // Check current step
    const currentURL = page.url();
    console.log(`\n📍 Current URL: ${currentURL}`);

    // Print network summary
    console.log('\n========================================');
    console.log('📡 NETWORK SUMMARY');
    console.log('========================================');

    const authRequests = networkRequests.filter(r => r.url.includes('auth'));
    console.log(`Auth requests: ${authRequests.length}`);
    authRequests.forEach(r => {
      console.log(`  ${r.status} ${r.url.split('/').slice(-2).join('/')}`);
    });

    if (networkErrors.length > 0) {
      console.log(`\nNetwork errors: ${networkErrors.length}`);
      networkErrors.forEach(e => console.log(`  ${e.url} - ${e.failure}`));
    }

    // Print relevant console logs
    console.log('\n========================================');
    console.log('📋 RELEVANT CONSOLE LOGS');
    console.log('========================================');

    const relevantLogs = consoleLogs.filter(l =>
      l.text.includes('Onboarding') ||
      l.text.includes('auth') ||
      l.text.includes('error') ||
      l.text.includes('Error') ||
      l.text.includes('supabase')
    );

    relevantLogs.slice(-20).forEach(l => {
      console.log(`  [${l.type}] ${l.text.substring(0, 200)}`);
    });

    // Continue with remaining steps to see what happens
    console.log('\n📍 Continuing through remaining steps...');

    // Give time to observe
    await page.waitForTimeout(3000);

    // Take final screenshot path
    console.log('\n========================================');
    console.log('📊 FINAL STATE');
    console.log('========================================');
    console.log(`Final URL: ${page.url()}`);

    // Check if user was created
    console.log('\n⚠️  Check Supabase for user: ' + TEST_EMAIL);
  });
});
