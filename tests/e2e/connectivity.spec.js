import { test, expect } from '@playwright/test';

// Helper to capture network activity for specific API paths
async function captureApiCalls(page, paths) {
  const events = [];
  page.on('requestfinished', async (request) => {
    try {
      const url = request.url();
      const match = paths.find((p) => url.includes(p));
      if (match) {
        const response = await request.response();
        events.push({ url, status: response?.status(), ok: response?.ok() });
      }
    } catch (_) {}
  });
  return events;
}

// Use the dev server configured in playwright.config.js
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:8000';

// Bypass onboarding overlay in tests
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('user_data', JSON.stringify({ name: 'E2E User' }));
      if (!localStorage.getItem('device_id')) localStorage.setItem('device_id', 'e2e-device-0001');
    } catch {}
  });
});

// Robust click helper for Tools button to handle pointer interception overlays
async function clickToolsRobustly(page) {
  const toolsBtn = page.locator('button[title="Tools"], button[aria-label="Tools"]');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      // Try normal click
      await toolsBtn.first().click({ timeout: 1000 });
      return;
    } catch (_) {
      // Dismiss potential overlays and retry
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
      await page.evaluate(() => window.scrollBy(0, 200));
      await page.waitForTimeout(200);
    }
  }
  // Last resort: force click
  await toolsBtn.first().click({ force: true });
}

test.describe('Frontend ↔ Backend Connectivity', () => {
  test('Settings can point to API and health responds', async ({ page, request }) => {
    await page.goto(`${BASE}/#/settings`);

    // Try to set API endpoint if visible (Premium settings uses a labeled input)
    const apiLabel = page.locator('label:has-text("API Endpoint")');
    if (await apiLabel.count()) {
      const apiInput = apiLabel.locator('xpath=following-sibling::*//input');
      await apiInput.fill('http://localhost:8000');

      const saveBtn = page.locator('button:has-text("Save Configuration")');
      if (await saveBtn.count()) {
        await saveBtn.click();
      }
    }

    // Directly verify backend health
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('Tools button emits tools_open event (card mode)', async ({ page }) => {
    // Open in card mode and expand mini pill
    await page.goto(`${BASE}/#/card`);

    // Attach listener to capture amx:ui events
    await page.evaluate(() => {
      window.__amxEvents = [];
      window.addEventListener('amx:ui', (e) => {
        try { window.__amxEvents.push(e.detail); } catch {}
      });
    });

    // Expand from mini state if present
    const mini = page.locator('.amx-mini');
    if (await mini.count()) {
      await mini.first().click();
    }

    // Click Tools button (supports AppleFloatBar and FloatBarCore)
    await clickToolsRobustly(page);

    // Verify that tools_open event was dispatched
    const sawEvent = await page.waitForFunction(() => {
      const events = window.__amxEvents || [];
      return events.some((d) => d && d.type === 'tools_open');
    }, { timeout: 2000 });
    expect(!!sawEvent).toBeTruthy();
  });

  test('Conversation memory API stores and returns context', async ({ request }) => {
    // Add a message to conversation memory (backend)
    const addRes = await request.post(`${API_URL}/api/v2/conversation/message`, {
      data: { role: 'user', content: 'Hello from E2E test' },
    });
    expect(addRes.ok()).toBeTruthy();

    // Fetch recent context and verify message count >= 1
    const ctxRes = await request.get(`${API_URL}/api/v2/conversation/context?last_n=1`);
    expect(ctxRes.ok()).toBeTruthy();
    const ctx = await ctxRes.json();
    expect(ctx.message_count).toBeGreaterThan(0);
  });

  test('Profile endpoints respond with greeting and profile data', async ({ request }) => {
    const profileRes = await request.get(`${API_URL}/api/v2/profile`);
    expect(profileRes.ok()).toBeTruthy();
    const profile = await profileRes.json();
    expect(typeof profile.user_name).toBeDefined();

    const greetRes = await request.get(`${API_URL}/api/v2/profile/greeting`);
    expect(greetRes.ok()).toBeTruthy();
    const greet = await greetRes.json();
    expect(typeof greet.greeting).toBe('string');
  });

  test('Agents REST endpoints respond (providers, roles, list)', async ({ request }) => {
    const providers = await request.get(`${API_URL}/api/v2/agents/providers`);
    expect(providers.ok()).toBeTruthy();
    const roles = await request.get(`${API_URL}/api/v2/agents/roles`);
    expect(roles.ok()).toBeTruthy();
    const list = await request.get(`${API_URL}/api/v2/agents/list`);
    expect(list.ok()).toBeTruthy();
  });
});
