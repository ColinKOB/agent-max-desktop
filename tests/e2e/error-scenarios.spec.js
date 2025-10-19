/**
 * E2E Tests - Error Scenarios
 * Tests system resilience and error handling
 */
import { test, expect } from '@playwright/test';

// Helper to simulate backend outage
async function simulateBackendOutage(page) {
  await page.route('**/api/**', route => {
    route.abort('connectionfailed');
  });
}

// Helper to restore backend
async function restoreBackend(page) {
  await page.unroute('**/api/**');
}

// Helper to simulate Stripe outage
async function simulateStripeOutage(page) {
  await page.route('**/stripe.com/**', route => {
    route.fulfill({
      status: 503,
      body: 'Service Unavailable'
    });
  });
}

// Helper to restore Stripe
async function restoreStripe(page) {
  await page.unroute('**/stripe.com/**');
}

async function login(page, email, password) {
  await page.goto('http://localhost:5173');
  await page.click('text=Sign In');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
}

test.describe('Error Scenarios', () => {
  test('Scenario 1: Graceful degradation when backend is down', async ({ page }) => {
    // Login first while backend is up
    await page.goto('http://localhost:5173');
    
    // Now simulate backend outage
    await simulateBackendOutage(page);
    
    // Try to sign in
    await page.click('text=Sign In');
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    
    // Should see connection error
    await page.waitForSelector('text=Connection lost. Please check your internet connection.');
    
    // Should show retry button
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    
    // Restore backend
    await restoreBackend(page);
    
    // Click retry
    await page.click('button:has-text("Retry")');
    
    // Should succeed now
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
  });

  test('Scenario 2: Circuit breaker handles Stripe outage', async ({ page, context }) => {
    // Login normally
    await page.goto('http://localhost:5173');
    await login(page, 'user@example.com', 'password123');
    
    // Simulate Stripe outage
    await simulateStripeOutage(page);
    
    // Execute a goal
    await page.fill('#goal-input', 'Test goal during Stripe outage');
    await page.click('text=Start');
    
    // Wait for completion
    await page.waitForSelector('text=Goal completed', { timeout: 30000 });
    
    // Mark as success
    await page.click('text=Mark Success');
    
    // Should see warning (not error) about billing delay
    await page.waitForSelector('text=Billing temporarily delayed. Your usage has been recorded.');
    
    // Check that goal was still recorded
    await expect(page.locator('.success-indicator')).toBeVisible();
    
    // Restore Stripe
    await restoreStripe(page);
    
    // Wait for automatic retry (simulate with reload)
    await page.waitForTimeout(5000);
    await page.reload();
    
    // Check sync status
    const syncStatus = await page.textContent('.sync-status');
    expect(syncStatus).toContain('Synced');
  });

  test('Scenario 3: Resumes after network interruption', async ({ page, context }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Start a goal
    await page.fill('#goal-input', 'Long running task to test network recovery');
    await page.click('text=Start');
    
    // Wait for execution to start
    await page.waitForSelector('text=Executing...', { timeout: 5000 });
    
    // Disconnect network
    await context.setOffline(true);
    
    // Should see offline indicator
    await page.waitForSelector('.offline-indicator', { timeout: 5000 });
    await expect(page.locator('text=You are offline')).toBeVisible();
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Reconnect
    await context.setOffline(false);
    
    // Should see reconnected message
    await page.waitForSelector('text=Reconnected');
    
    // Goal should resume and complete
    await page.waitForSelector('text=Goal completed', { timeout: 30000 });
    
    // Verify data is intact
    await page.click('text=Mark Success');
    await page.waitForSelector('text=Billed: $3.00');
  });

  test('Scenario 4: Handles rate limiting gracefully', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Simulate rate limit by making many rapid requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        page.evaluate(() => 
          fetch('/api/billing/usage').then(r => r.status)
        )
      );
    }
    
    const results = await Promise.all(promises);
    
    // Some requests should be rate limited
    const rateLimited = results.filter(status => status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    
    // UI should show rate limit warning
    await page.waitForSelector('text=Please slow down. Too many requests.', { timeout: 5000 });
    
    // Wait for rate limit to clear
    await page.waitForTimeout(5000);
    
    // Should work again
    await page.click('button:has-text("Refresh")');
    await page.waitForSelector('.usage-count', { timeout: 5000 });
  });

  test('Scenario 5: Handles invalid API responses', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Mock invalid API response
    await page.route('**/api/billing/usage', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json{{'
      });
    });
    
    // Navigate to dashboard
    await page.goto('http://localhost:5173/#/dashboard');
    
    // Should show error state
    await page.waitForSelector('text=Unable to load usage data');
    
    // Should offer retry
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    
    // Fix the route
    await page.unroute('**/api/billing/usage');
    
    // Retry should work
    await page.click('button:has-text("Retry")');
    await page.waitForSelector('.usage-count', { timeout: 5000 });
  });

  test('Scenario 6: Handles session expiration', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Simulate session expiration
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
    });
    
    // Try to perform an action
    await page.fill('#goal-input', 'Test after session expired');
    await page.click('text=Start');
    
    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 5000 });
    
    // Should show session expired message
    await expect(page.locator('text=Your session has expired. Please sign in again.')).toBeVisible();
    
    // Login again
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    
    // Should return to previous page
    await page.waitForSelector('#goal-input');
    
    // Goal input should be preserved
    const goalValue = await page.inputValue('#goal-input');
    expect(goalValue).toBe('Test after session expired');
  });

  test('Scenario 7: Handles concurrent goal execution limit', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Start first goal
    await page.fill('#goal-input', 'First goal');
    await page.click('text=Start');
    await page.waitForSelector('text=Executing...', { timeout: 5000 });
    
    // Try to start second goal immediately
    await page.fill('#goal-input', 'Second goal');
    await page.click('text=Start');
    
    // Should show warning
    await page.waitForSelector('text=Please wait for the current goal to complete');
    
    // Wait for first goal to complete
    await page.waitForSelector('text=Goal completed', { timeout: 30000 });
    await page.click('text=Mark Success');
    
    // Now second goal should work
    await page.fill('#goal-input', 'Second goal');
    await page.click('text=Start');
    await page.waitForSelector('text=Executing...', { timeout: 5000 });
  });

  test('Scenario 8: Handles database connection failure', async ({ page }) => {
    // Simulate database error
    await page.route('**/api/goals/execute', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Database connection failed',
          code: 'DB_CONNECTION_ERROR'
        })
      });
    });
    
    await login(page, 'user@example.com', 'password123');
    
    // Try to execute goal
    await page.fill('#goal-input', 'Test during DB failure');
    await page.click('text=Start');
    
    // Should show specific database error
    await page.waitForSelector('text=Database connection error. Our team has been notified.');
    
    // Should log to console (for debugging)
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));
    
    // Verify error was logged
    expect(consoleLogs.some(log => log.includes('DB_CONNECTION_ERROR'))).toBeTruthy();
  });

  test('Scenario 9: Handles WebSocket disconnection', async ({ page, context }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Start listening for WebSocket
    const wsPromise = page.waitForEvent('websocket');
    
    // Trigger WebSocket connection (by going to dashboard)
    await page.goto('http://localhost:5173/#/dashboard');
    
    const ws = await wsPromise;
    
    // Wait for connection
    await ws.waitForEvent('open');
    
    // Simulate disconnection
    await page.evaluate(() => {
      window.ws?.close();
    });
    
    // Should show disconnected indicator
    await page.waitForSelector('.realtime-status:has-text("Disconnected")');
    
    // Should attempt reconnection
    await page.waitForSelector('.realtime-status:has-text("Reconnecting...")', { timeout: 5000 });
    
    // Should reconnect
    await page.waitForSelector('.realtime-status:has-text("Connected")', { timeout: 10000 });
  });

  test('Scenario 10: Handles browser back/forward navigation', async ({ page }) => {
    await login(page, 'user@example.com', 'password123');
    
    // Navigate through app
    await page.goto('http://localhost:5173/#/dashboard');
    await page.waitForSelector('.usage-count');
    
    await page.goto('http://localhost:5173/#/settings');
    await page.waitForSelector('text=Settings');
    
    await page.goto('http://localhost:5173/#/billing');
    await page.waitForSelector('text=Billing History');
    
    // Go back
    await page.goBack();
    await page.waitForSelector('text=Settings');
    
    // Go back again
    await page.goBack();
    await page.waitForSelector('.usage-count');
    
    // Go forward
    await page.goForward();
    await page.waitForSelector('text=Settings');
    
    // State should be preserved
    const activeTab = await page.getAttribute('.settings-tab.active', 'data-tab');
    expect(activeTab).toBeTruthy();
  });
});
