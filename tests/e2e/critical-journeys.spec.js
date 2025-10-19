/**
 * E2E Tests - Critical User Journeys
 * Tests complete user workflows from signup to billing
 */
import { test, expect } from '@playwright/test';

// Helper functions
async function login(page, email, password) {
  await page.goto('http://localhost:5173');
  await page.click('text=Sign In');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Dashboard', { timeout: 5000 });
}

async function executeGoal(page, goalText) {
  await page.fill('#goal-input', goalText);
  await page.click('text=Start');
  await page.waitForSelector('text=Executing...', { timeout: 5000 });
}

async function markSuccess(page) {
  await page.waitForSelector('text=Goal completed', { timeout: 30000 });
  await page.click('text=Mark Success');
}

async function fillPaymentForm(page, cardDetails) {
  await page.fill('[name=cardNumber]', cardDetails.number);
  await page.fill('[name=cardExpiry]', cardDetails.expiry);
  await page.fill('[name=cardCvc]', cardDetails.cvc);
  await page.fill('[name=cardZip]', cardDetails.zip || '10001');
}

const validCard = {
  number: '4242424242424242',
  expiry: '1225',
  cvc: '123',
  zip: '10001'
};

test.describe('Critical User Journeys', () => {
  test('Journey 1: New user can sign up and complete first goal', async ({ page }) => {
    // 1. Land on homepage
    await page.goto('http://localhost:5173');
    
    // 2. Click sign up
    await page.click('text=Sign Up');
    
    // 3. Complete signup form
    await page.fill('#email', `test${Date.now()}@example.com`);
    await page.fill('#password', 'SecurePassword123!');
    await page.fill('#confirmPassword', 'SecurePassword123!');
    await page.click('button[type=submit]');
    
    // 4. Onboarding - Welcome screen
    await page.waitForSelector('text=Welcome to Agent Max');
    await page.click('text=Get Started');
    
    // 5. Onboarding - Setup
    await page.fill('input[placeholder*="Your name"]', 'Test User');
    await page.click('text=Continue');
    
    // 6. Onboarding - Add payment method (Stripe test card)
    await page.waitForSelector('text=Payment Method');
    await fillPaymentForm(page, validCard);
    await page.click('text=Continue');
    
    // 7. Onboarding - Complete
    await page.waitForSelector("text=You're all set");
    await page.click('text=Start Using Agent Max');
    
    // 8. Enter first goal
    await page.waitForSelector('#goal-input');
    await page.fill('#goal-input', 'Check my email and summarize important messages');
    await page.click('text=Start');
    
    // 9. Wait for execution
    await page.waitForSelector('text=Goal completed', { timeout: 30000 });
    
    // 10. Mark as successful
    await page.click('text=Mark Success');
    
    // 11. Verify billing toast
    await page.waitForSelector('text=Billed: $3.00');
    
    // 12. Check usage dashboard
    await page.click('text=Dashboard');
    const usage = await page.textContent('.usage-count');
    expect(usage).toBe('1');
    
    const cost = await page.textContent('.estimated-cost');
    expect(cost).toBe('$3.00');
  });

  test('Journey 2: Existing user executes multiple goals and views usage', async ({ page }) => {
    // Login with existing user
    await login(page, 'existing@example.com', 'password123');
    
    // Execute 3 goals
    for (let i = 0; i < 3; i++) {
      await executeGoal(page, `Test goal ${i + 1}: Analyze data and create report`);
      await markSuccess(page);
      
      // Verify billing notification
      await page.waitForSelector('text=Billed: $3.00');
      
      // Dismiss toast
      await page.click('.toast-dismiss');
    }
    
    // Navigate to dashboard
    await page.goto('http://localhost:5173/#/dashboard');
    
    // Check usage count
    const usage = await page.textContent('.usage-count');
    expect(parseInt(usage)).toBeGreaterThanOrEqual(3);
    
    // Check estimated cost
    const cost = await page.textContent('.estimated-cost');
    const costValue = parseFloat(cost.replace('$', ''));
    expect(costValue).toBeGreaterThanOrEqual(9.00);
    
    // Check chart is displayed
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
    
    // Check daily usage breakdown
    await expect(page.locator('.daily-usage-table')).toBeVisible();
  });

  test('Journey 3: User views and downloads billing history', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Navigate to settings
    await page.click('text=Settings');
    
    // Click on billing tab
    await page.click('text=Billing & Usage');
    
    // Wait for billing history to load
    await page.waitForSelector('.invoice-card', { timeout: 10000 });
    
    // Check invoice list is populated
    const invoices = await page.$$('.invoice-card');
    expect(invoices.length).toBeGreaterThan(0);
    
    // Get first invoice details
    const invoiceDate = await page.textContent('.invoice-card:first-child .invoice-date');
    const invoiceAmount = await page.textContent('.invoice-card:first-child .invoice-amount');
    expect(invoiceDate).toBeTruthy();
    expect(invoiceAmount).toContain('$');
    
    // Download first invoice
    const downloadPromise = page.waitForEvent('download');
    await page.click('.invoice-card:first-child button[aria-label="Download PDF"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf$/i);
    
    // Test date filtering
    await page.fill('input[name="startDate"]', '2025-10-01');
    await page.fill('input[name="endDate"]', '2025-10-31');
    await page.click('button:has-text("Filter")');
    
    // Wait for filtered results
    await page.waitForTimeout(1000);
    
    // Export to CSV
    await page.click('button:has-text("Export CSV")');
    const csvDownload = await page.waitForEvent('download');
    expect(csvDownload.suggestedFilename()).toMatch(/billing.*\.csv$/i);
  });

  test('Journey 4: User recovers from payment failure', async ({ page }) => {
    // Setup: User with declined card
    await login(page, 'declined@example.com', 'password123');
    
    // Try to execute goal
    await executeGoal(page, 'Important task that needs billing');
    await markSuccess(page);
    
    // Should see payment error
    await page.waitForSelector('text=Payment method declined');
    
    // Click update payment
    await page.click('text=Update Payment Method');
    
    // Should navigate to payment settings
    await page.waitForSelector('text=Payment Settings');
    
    // Remove old card
    await page.click('button[aria-label="Remove payment method"]');
    await page.click('text=Confirm');
    
    // Add new valid card
    await page.click('text=Add Payment Method');
    await fillPaymentForm(page, validCard);
    await page.click('text=Save');
    
    // Wait for success
    await page.waitForSelector('text=Payment method added successfully');
    
    // Go back and retry the goal
    await page.click('text=Back to Goals');
    await page.click('text=Retry');
    
    // Should succeed this time
    await page.waitForSelector('text=Billed: $3.00');
    
    // Verify in dashboard
    await page.goto('http://localhost:5173/#/dashboard');
    const status = await page.textContent('.payment-status');
    expect(status).toBe('Active');
  });

  test('Journey 5: User hits usage limit and upgrades', async ({ page }) => {
    await login(page, 'limited@example.com', 'password123');
    
    // Check current usage (should be near limit)
    await page.goto('http://localhost:5173/#/dashboard');
    const usage = await page.textContent('.usage-count');
    const limit = await page.textContent('.usage-limit');
    
    expect(parseInt(usage)).toBeGreaterThanOrEqual(45);
    expect(parseInt(limit)).toBe(50);
    
    // See quota warning
    await expect(page.locator('text=/You have used .* of your monthly limit/')).toBeVisible();
    
    // Click upgrade
    await page.click('button:has-text("Upgrade Plan")');
    
    // Should show plan options
    await page.waitForSelector('text=Choose Your Plan');
    
    // Select higher tier
    await page.click('.plan-card:has-text("Professional")');
    await page.click('text=Upgrade Now');
    
    // Confirm upgrade
    await page.waitForSelector('text=Confirm Plan Change');
    await page.click('text=Confirm');
    
    // Should see success
    await page.waitForSelector('text=Plan upgraded successfully');
    
    // Check new limit
    await page.goto('http://localhost:5173/#/dashboard');
    const newLimit = await page.textContent('.usage-limit');
    expect(parseInt(newLimit)).toBeGreaterThan(50);
  });

  test('Journey 6: User manages notification preferences', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Go to settings
    await page.click('text=Settings');
    await page.click('text=Notifications');
    
    // Toggle email notifications
    const emailToggle = page.locator('input[name="emailNotifications"]');
    await emailToggle.click();
    
    // Set billing alerts threshold
    await page.fill('input[name="billingAlertThreshold"]', '100');
    
    // Enable desktop notifications
    const desktopToggle = page.locator('input[name="desktopNotifications"]');
    await desktopToggle.click();
    
    // Save settings
    await page.click('button:has-text("Save Changes")');
    
    // Should see success
    await page.waitForSelector('text=Settings saved successfully');
    
    // Verify settings persisted
    await page.reload();
    await page.waitForSelector('text=Notifications');
    
    const threshold = await page.inputValue('input[name="billingAlertThreshold"]');
    expect(threshold).toBe('100');
  });

  test('Journey 7: User uses command palette for quick actions', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Open command palette
    await page.keyboard.press('Meta+k'); // or Control+k on Windows/Linux
    
    // Should see command palette
    await page.waitForSelector('.command-palette');
    
    // Search for dashboard
    await page.fill('input[placeholder*="Type a command"]', 'dashboard');
    
    // Should see dashboard option
    await expect(page.locator('text=Go to Dashboard')).toBeVisible();
    
    // Select it
    await page.keyboard.press('Enter');
    
    // Should navigate to dashboard
    await page.waitForURL('**/dashboard');
    
    // Open palette again and search for settings
    await page.keyboard.press('Meta+k');
    await page.fill('input[placeholder*="Type a command"]', 'billing');
    await page.keyboard.press('Enter');
    
    // Should navigate to billing
    await page.waitForSelector('text=Billing & Usage');
  });
});
