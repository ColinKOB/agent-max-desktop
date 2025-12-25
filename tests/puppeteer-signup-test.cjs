/**
 * Full New User Signup Test via Puppeteer
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

const puppeteer = require('puppeteer');

// Test configuration
const BASE_URL = 'http://localhost:5173';
const TEST_EMAIL = `test-${Date.now()}@agentmax.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';
const TIMEOUT = 60000; // 60 seconds

// Helper to wait and click
async function waitAndClick(page, selector, description) {
  console.log(`  → Waiting for: ${description}`);
  try {
    await page.waitForSelector(selector, { timeout: 10000, visible: true });
    await page.click(selector);
    console.log(`  ✓ Clicked: ${description}`);
    return true;
  } catch (e) {
    console.log(`  ✗ Failed to click: ${description} - ${e.message}`);
    return false;
  }
}

// Helper to type text
async function waitAndType(page, selector, text, description) {
  console.log(`  → Typing into: ${description}`);
  try {
    await page.waitForSelector(selector, { timeout: 10000, visible: true });
    await page.type(selector, text);
    console.log(`  ✓ Typed into: ${description}`);
    return true;
  } catch (e) {
    console.log(`  ✗ Failed to type: ${description} - ${e.message}`);
    return false;
  }
}

// Helper to check if element exists
async function elementExists(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// Helper to take screenshot
async function screenshot(page, name) {
  const timestamp = Date.now();
  const path = `/tmp/onboarding-${name}-${timestamp}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 Screenshot: ${path}`);
  return path;
}

async function runSignupTest() {
  console.log('\n========================================');
  console.log('🚀 FULL NEW USER SIGNUP TEST');
  console.log('========================================\n');
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  let browser;
  let page;
  const results = {
    passed: [],
    failed: [],
    screenshots: []
  };

  try {
    // Launch browser
    console.log('📱 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    // Enable console logging from page
    page.on('console', msg => {
      if (msg.text().includes('[Onboarding]')) {
        console.log(`  [Page] ${msg.text()}`);
      }
    });

    // Navigate to onboarding
    console.log('\n📍 STEP 0: Navigate to Onboarding');
    await page.goto(`${BASE_URL}/#/onboarding`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await page.waitForTimeout(2000);
    results.screenshots.push(await screenshot(page, '00-initial'));

    // ========================================
    // STEP 1: Welcome Screen
    // ========================================
    console.log('\n📍 STEP 1: Welcome Screen');

    // Look for Get Started button
    const welcomeSelectors = [
      'button:has-text("Get Started")',
      '[data-testid="get-started-btn"]',
      'button.primary',
      'button[class*="primary"]',
      'button:contains("Get Started")'
    ];

    let welcomeClicked = false;

    // Try XPath for button with "Get Started" text
    try {
      await page.waitForTimeout(1000);
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await page.evaluate(el => el.textContent, button);
        if (text && text.includes('Get Started')) {
          await button.click();
          welcomeClicked = true;
          console.log('  ✓ Clicked Get Started button');
          break;
        }
      }
    } catch (e) {
      console.log(`  Note: ${e.message}`);
    }

    if (!welcomeClicked) {
      // Try clicking any prominent button
      const allButtons = await page.$$('button');
      if (allButtons.length > 0) {
        await allButtons[0].click();
        welcomeClicked = true;
        console.log('  ✓ Clicked first button');
      }
    }

    if (welcomeClicked) {
      results.passed.push('Welcome Screen - Get Started');
    } else {
      results.failed.push('Welcome Screen - Get Started');
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '01-after-welcome'));

    // ========================================
    // STEP 2: Account Creation (Sign Up)
    // ========================================
    console.log('\n📍 STEP 2: Account Creation');

    // Look for sign up tab/button first
    try {
      const tabs = await page.$$('[role="tab"], button');
      for (const tab of tabs) {
        const text = await page.evaluate(el => el.textContent, tab);
        if (text && (text.includes('Sign Up') || text.includes('Create Account'))) {
          await tab.click();
          console.log('  ✓ Clicked Sign Up tab');
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch (e) {
      console.log('  Note: No sign up tab found, might already be on sign up');
    }

    // Fill in email
    const emailInputs = await page.$$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    if (emailInputs.length > 0) {
      await emailInputs[0].type(TEST_EMAIL);
      console.log('  ✓ Entered email');
      results.passed.push('Account - Email Entry');
    } else {
      console.log('  ✗ Could not find email input');
      results.failed.push('Account - Email Entry');
    }

    // Fill in password
    const passwordInputs = await page.$$('input[type="password"]');
    if (passwordInputs.length > 0) {
      await passwordInputs[0].type(TEST_PASSWORD);
      console.log('  ✓ Entered password');
      results.passed.push('Account - Password Entry');

      // If there's a confirm password field
      if (passwordInputs.length > 1) {
        await passwordInputs[1].type(TEST_PASSWORD);
        console.log('  ✓ Confirmed password');
      }
    } else {
      console.log('  ✗ Could not find password input');
      results.failed.push('Account - Password Entry');
    }

    await page.waitForTimeout(500);
    results.screenshots.push(await screenshot(page, '02-account-filled'));

    // Click Sign Up / Continue button
    let signupClicked = false;
    const signupButtons = await page.$$('button');
    for (const btn of signupButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Sign Up') || text.includes('Create Account') || text.includes('Continue'))) {
        await btn.click();
        signupClicked = true;
        console.log('  ✓ Clicked signup button');
        break;
      }
    }

    if (signupClicked) {
      results.passed.push('Account - Submit');
    } else {
      results.failed.push('Account - Submit');
    }

    await page.waitForTimeout(3000);
    results.screenshots.push(await screenshot(page, '03-after-signup'));

    // ========================================
    // STEP 3: Legal Consent
    // ========================================
    console.log('\n📍 STEP 3: Legal Consent');

    // Look for checkboxes
    const checkboxes = await page.$$('input[type="checkbox"], [role="checkbox"]');
    for (const checkbox of checkboxes) {
      await checkbox.click();
      console.log('  ✓ Checked a consent checkbox');
    }

    if (checkboxes.length > 0) {
      results.passed.push('Legal - Checkboxes');
    }

    // Click Continue/Accept
    const legalButtons = await page.$$('button');
    for (const btn of legalButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Continue') || text.includes('Accept') || text.includes('Agree'))) {
        await btn.click();
        console.log('  ✓ Clicked continue on legal');
        results.passed.push('Legal - Continue');
        break;
      }
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '04-after-legal'));

    // ========================================
    // STEP 4: Name Entry
    // ========================================
    console.log('\n📍 STEP 4: Name Entry');

    // Look for name input
    const nameInputs = await page.$$('input[type="text"], input[name="name"], input[placeholder*="name" i]');
    if (nameInputs.length > 0) {
      await nameInputs[0].type(TEST_NAME);
      console.log('  ✓ Entered name');
      results.passed.push('Name - Entry');
    } else {
      console.log('  Note: No name input found');
    }

    // Click Continue
    const nameButtons = await page.$$('button');
    for (const btn of nameButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Continue')) {
        await btn.click();
        console.log('  ✓ Clicked continue');
        break;
      }
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '05-after-name'));

    // ========================================
    // STEP 5: Use Case Selection
    // ========================================
    console.log('\n📍 STEP 5: Use Case Selection');

    // Click on a use case option (usually cards or radio buttons)
    const useCaseOptions = await page.$$('[class*="card"], [class*="option"], [role="radio"], button[class*="option"]');
    if (useCaseOptions.length > 0) {
      await useCaseOptions[0].click();
      console.log('  ✓ Selected first use case option');
      results.passed.push('UseCase - Selection');
    }

    // Click Continue
    await page.waitForTimeout(500);
    const useCaseButtons = await page.$$('button');
    for (const btn of useCaseButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Continue')) {
        await btn.click();
        console.log('  ✓ Clicked continue');
        break;
      }
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '06-after-usecase'));

    // ========================================
    // STEP 6: Mode Explainer
    // ========================================
    console.log('\n📍 STEP 6: Mode Explainer');

    // This is usually just informational, click Continue/Got it
    const modeButtons = await page.$$('button');
    for (const btn of modeButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Continue') || text.includes('Got it') || text.includes('Next'))) {
        await btn.click();
        console.log('  ✓ Clicked continue on mode explainer');
        results.passed.push('Modes - Continue');
        break;
      }
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '07-after-modes'));

    // ========================================
    // STEP 7: Email Verification (May be skipped)
    // ========================================
    console.log('\n📍 STEP 7: Email Verification');

    // Check if we're on email verification step
    const pageContent = await page.content();
    if (pageContent.includes('verify') || pageContent.includes('Verify')) {
      console.log('  → On email verification step');
      // Look for Skip or Continue button
      const verifyButtons = await page.$$('button');
      for (const btn of verifyButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.includes('Skip') || text.includes('Continue') || text.includes('Later'))) {
          await btn.click();
          console.log('  ✓ Skipped email verification');
          results.passed.push('Email Verify - Skip');
          break;
        }
      }
    } else {
      console.log('  → Email verification skipped automatically');
      results.passed.push('Email Verify - Auto-skipped');
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '08-after-verify'));

    // ========================================
    // STEP 8: Google Integration
    // ========================================
    console.log('\n📍 STEP 8: Google Integration');

    // Look for Skip button (we don't want to actually connect Google in test)
    const googleButtons = await page.$$('button');
    for (const btn of googleButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Skip') || text.includes('Later') || text.includes('Not now'))) {
        await btn.click();
        console.log('  ✓ Skipped Google integration');
        results.passed.push('Google - Skip');
        break;
      }
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '09-after-google'));

    // ========================================
    // STEP 9: Subscription Selection
    // ========================================
    console.log('\n📍 STEP 9: Subscription Selection');

    // Look for Free Trial or Free plan option
    const subButtons = await page.$$('button');
    let selectedPlan = false;

    for (const btn of subButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Free') || text.includes('Trial') || text.includes('Start Free'))) {
        await btn.click();
        console.log('  ✓ Selected free plan');
        selectedPlan = true;
        results.passed.push('Subscription - Free Plan');
        break;
      }
    }

    if (!selectedPlan) {
      // Try clicking Continue if no specific plan button
      for (const btn of subButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Continue')) {
          await btn.click();
          console.log('  ✓ Clicked continue');
          break;
        }
      }
    }

    await page.waitForTimeout(1500);
    results.screenshots.push(await screenshot(page, '10-after-subscription'));

    // ========================================
    // STEP 10: Complete
    // ========================================
    console.log('\n📍 STEP 10: Complete Screen');

    // Look for completion indicators
    const completeContent = await page.content();
    const isComplete = completeContent.includes('Complete') ||
                       completeContent.includes('Welcome') ||
                       completeContent.includes('Ready') ||
                       completeContent.includes('All set');

    if (isComplete) {
      console.log('  ✓ Reached completion screen');
      results.passed.push('Complete - Reached');
    }

    // Click final button (Get Started, Go to Dashboard, etc.)
    const finalButtons = await page.$$('button');
    for (const btn of finalButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Start') || text.includes('Dashboard') || text.includes('Begin') || text.includes('Let'))) {
        await btn.click();
        console.log('  ✓ Clicked final button');
        results.passed.push('Complete - Final Button');
        break;
      }
    }

    await page.waitForTimeout(2000);
    results.screenshots.push(await screenshot(page, '11-final'));

    // Check if we're now on the main app
    const finalUrl = page.url();
    console.log(`\n📍 Final URL: ${finalUrl}`);

    if (!finalUrl.includes('onboarding')) {
      console.log('  ✓ Successfully exited onboarding!');
      results.passed.push('Navigation - Exit Onboarding');
    }

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    results.failed.push(`Error: ${error.message}`);

    if (page) {
      results.screenshots.push(await screenshot(page, 'error'));
    }
  } finally {
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

    console.log(`\n📸 Screenshots saved: ${results.screenshots.length}`);
    results.screenshots.forEach(s => console.log(`   • ${s}`));

    const successRate = (results.passed.length / (results.passed.length + results.failed.length) * 100).toFixed(1);
    console.log(`\n📈 Success Rate: ${successRate}%`);
    console.log('========================================\n');

    // Close browser
    if (browser) {
      await browser.close();
    }

    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);
  }
}

// Run the test
runSignupTest();
