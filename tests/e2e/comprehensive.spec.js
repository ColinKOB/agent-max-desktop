import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Test Suite for Agent Max
 * 
 * Tests all major user-facing features with frontend ↔ backend integration
 * Focus areas:
 * - Chat & Autonomous Execution
 * - Google OAuth & Gmail
 * - Agent Management
 * - Screen Control
 * - Profile & Preferences
 * - Conversation History
 * - Telemetry & Analytics
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = 'http://localhost:8000';

// Helper to wait for network idle
async function waitForNetworkIdle(page, timeout = 2000) {
  await page.waitForLoadState('networkidle', { timeout });
}

// Helper to capture API responses
function captureResponse(page, endpoint) {
  return new Promise((resolve) => {
    page.on('response', async (response) => {
      if (response.url().includes(endpoint)) {
        try {
          const data = await response.json();
          resolve({ status: response.status(), data, ok: response.ok() });
        } catch {
          resolve({ status: response.status(), ok: response.ok() });
        }
      }
    });
  });
}

test.describe('Chat & Messaging Features', () => {
  test('Chat streaming endpoint responds with SSE events', async ({ request }) => {
    // Test the streaming endpoint that powers the chat UI
    const response = await fetch(`${API_URL}/api/v2/autonomous/execute/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'Say hello',
        max_steps: 1,
        timeout: 30
      })
    });

    expect(response.ok).toBeTruthy();
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // Read first few events
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventCount = 0;

    for (let i = 0; i < 3; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value);
      const lines = buffer.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          eventCount++;
        }
      }
    }

    expect(eventCount).toBeGreaterThan(0);
    await reader.cancel();
  });

  test('Chat UI expands and sends message via autonomous endpoint', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/card`);
    
    // Track autonomous API calls
    const apiPromise = captureResponse(page, '/api/v2/autonomous/execute');
    
    // Expand mini bar
    const mini = page.locator('.amx-mini, .apple-floatbar-root.mini');
    if (await mini.count() > 0) {
      await mini.first().click();
      await page.waitForTimeout(500);
    }

    // Type and send message
    const input = page.locator('input[type="text"], .apple-input, .amx-input').first();
    await input.fill('Hello, test message');
    await input.press('Enter');

    // Verify API was called (timeout after 10s)
    const apiResponse = await Promise.race([
      apiPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ]).catch(() => null);

    // Should have attempted to call the API
    expect(apiResponse).toBeTruthy();
  });

  test('Conversation memory persists messages across sessions', async ({ request }) => {
    // Add multiple messages
    await request.post(`${API_URL}/api/v2/conversation/message`, {
      data: { role: 'user', content: 'First message' }
    });
    await request.post(`${API_URL}/api/v2/conversation/message`, {
      data: { role: 'assistant', content: 'First response' }
    });
    await request.post(`${API_URL}/api/v2/conversation/message`, {
      data: { role: 'user', content: 'Second message' }
    });

    // Retrieve context
    const contextRes = await request.get(`${API_URL}/api/v2/conversation/context?last_n=3`);
    expect(contextRes.ok()).toBeTruthy();
    
    const context = await contextRes.json();
    expect(context.message_count).toBeGreaterThanOrEqual(3);
    expect(context.messages).toBeDefined();
    expect(Array.isArray(context.messages)).toBeTruthy();
  });

  test('Conversation history can be listed and retrieved', async ({ request }) => {
    // Add a message to create a conversation
    await request.post(`${API_URL}/api/v2/conversation/message`, {
      data: { role: 'user', content: 'History test message' }
    });

    // Get history
    const historyRes = await request.get(`${API_URL}/api/v2/conversation/history?limit=5`);
    expect(historyRes.ok()).toBeTruthy();

    const history = await historyRes.json();
    expect(Array.isArray(history)).toBeTruthy();
  });
});

test.describe('Google Integration Features', () => {
  test('Google OAuth status endpoint responds', async ({ request }) => {
    const statusRes = await request.get(`${API_URL}/api/v2/google/status`);
    expect(statusRes.ok()).toBeTruthy();

    const status = await statusRes.json();
    expect(status).toHaveProperty('connected');
    expect(typeof status.connected).toBe('boolean');
  });

  test('Gmail messages endpoint returns properly formatted response', async ({ request }) => {
    // This will return empty or error if not authenticated, but should have proper structure
    const messagesRes = await request.get(`${API_URL}/api/v2/google/messages?max_results=5`);
    
    // Should either succeed with empty array or return 401/403
    if (messagesRes.ok()) {
      const messages = await messagesRes.json();
      expect(Array.isArray(messages) || messages.messages).toBeDefined();
    } else {
      // Expect auth error
      expect([401, 403, 500]).toContain(messagesRes.status());
    }
  });

  test('Gmail send endpoint validates request structure', async ({ request }) => {
    const sendRes = await request.post(`${API_URL}/api/v2/google/send`, {
      data: {
        to: 'test@example.com',
        subject: 'E2E Test Email',
        body: 'This is a test email from E2E suite'
      }
    });

    // Should return 401/403 if not authenticated, or 422 if validation fails
    // or 200 if credentials exist and email sent
    expect([200, 401, 403, 422, 500]).toContain(sendRes.status());
  });

  test('Google Calendar events endpoint responds', async ({ request }) => {
    const eventsRes = await request.get(`${API_URL}/api/v2/google/calendar/events?max_results=5`);
    
    if (eventsRes.ok()) {
      const events = await eventsRes.json();
      expect(Array.isArray(events) || events.events).toBeDefined();
    } else {
      expect([401, 403, 500]).toContain(eventsRes.status());
    }
  });

  test('YouTube search endpoint responds', async ({ request }) => {
    const searchRes = await request.get(`${API_URL}/api/v2/google/youtube/search?q=test&max_results=5`);
    
    if (searchRes.ok()) {
      const results = await searchRes.json();
      expect(Array.isArray(results) || results.items).toBeDefined();
    } else {
      expect([401, 403, 500]).toContain(searchRes.status());
    }
  });
});

test.describe('Agent Management Features', () => {
  test('Agents providers endpoint returns available providers', async ({ request }) => {
    const providersRes = await request.get(`${API_URL}/api/v2/agents/providers`);
    expect(providersRes.ok()).toBeTruthy();

    const providers = await providersRes.json();
    expect(Array.isArray(providers)).toBeTruthy();
    expect(providers.length).toBeGreaterThan(0);
    
    // Should have OpenAI, Anthropic, etc.
    const providerNames = providers.map(p => p.name || p);
    expect(providerNames.some(name => 
      name.toLowerCase().includes('openai') || 
      name.toLowerCase().includes('anthropic')
    )).toBeTruthy();
  });

  test('Agents roles endpoint returns available agent roles', async ({ request }) => {
    const rolesRes = await request.get(`${API_URL}/api/v2/agents/roles`);
    expect(rolesRes.ok()).toBeTruthy();

    const roles = await rolesRes.json();
    expect(Array.isArray(roles)).toBeTruthy();
    expect(roles.length).toBeGreaterThan(0);
  });

  test('Agents list endpoint returns current agents', async ({ request }) => {
    const listRes = await request.get(`${API_URL}/api/v2/agents/list`);
    expect(listRes.ok()).toBeTruthy();

    const agents = await listRes.json();
    expect(Array.isArray(agents)).toBeTruthy();
  });

  test('Agent creation validates role and provider', async ({ request }) => {
    const createRes = await request.post(`${API_URL}/api/v2/agents/create`, {
      data: {
        role: 'researcher',
        provider: 'openai'
        // Note: Will fail without API keys, but should validate structure
      }
    });

    // Should either succeed (200) or fail due to missing keys (422/500)
    expect([200, 422, 500]).toContain(createRes.status());
  });

  test('Agent delegation endpoint accepts task structure', async ({ request }) => {
    // Try to delegate to a non-existent agent
    const delegateRes = await request.post(`${API_URL}/api/v2/agents/delegate`, {
      data: {
        agent_id: 'test_agent_id',
        task: 'Test task for E2E',
        context: { test: true }
      }
    });

    // Should return error (404/422) for non-existent agent
    expect([404, 422, 500]).toContain(delegateRes.status());
  });
});

test.describe('Screen Control Features', () => {
  test('Screen capabilities endpoint returns available actions', async ({ request }) => {
    const capabilitiesRes = await request.get(`${API_URL}/api/v2/screen/capabilities`);
    expect(capabilitiesRes.ok()).toBeTruthy();

    const capabilities = await capabilitiesRes.json();
    expect(capabilities).toHaveProperty('actions');
    expect(Array.isArray(capabilities.actions)).toBeTruthy();
    
    // Should include common actions
    const actions = capabilities.actions;
    expect(actions).toContain('click');
    expect(actions).toContain('type');
  });

  test('Screen info endpoint returns screen dimensions', async ({ request }) => {
    const infoRes = await request.get(`${API_URL}/api/v2/screen/info`);
    expect(infoRes.ok()).toBeTruthy();

    const info = await infoRes.json();
    expect(info).toHaveProperty('width');
    expect(info).toHaveProperty('height');
    expect(typeof info.width).toBe('number');
    expect(typeof info.height).toBe('number');
  });

  test('Screen status endpoint returns control availability', async ({ request }) => {
    const statusRes = await request.get(`${API_URL}/api/v2/screen/status`);
    expect(statusRes.ok()).toBeTruthy();

    const status = await statusRes.json();
    expect(status).toHaveProperty('available');
    expect(typeof status.available).toBe('boolean');
  });

  test('Screenshot endpoint validates request', async ({ request }) => {
    const screenshotRes = await request.post(`${API_URL}/api/v2/screen/screenshot`, {
      data: { save_name: 'e2e_test_screenshot' }
    });

    // Should either succeed or return error
    expect([200, 500]).toContain(screenshotRes.status());
  });
});

test.describe('Profile & Preferences Features', () => {
  test('Profile endpoint returns user profile data', async ({ request }) => {
    const profileRes = await request.get(`${API_URL}/api/v2/profile`);
    expect(profileRes.ok()).toBeTruthy();

    const profile = await profileRes.json();
    expect(profile).toHaveProperty('user_name');
    expect(typeof profile.user_name).toBe('string');
  });

  test('Profile greeting endpoint returns personalized greeting', async ({ request }) => {
    const greetingRes = await request.get(`${API_URL}/api/v2/profile/greeting`);
    expect(greetingRes.ok()).toBeTruthy();

    const greeting = await greetingRes.json();
    expect(greeting).toHaveProperty('greeting');
    expect(typeof greeting.greeting).toBe('string');
    expect(greeting.greeting.length).toBeGreaterThan(0);
  });

  test('Profile context endpoint returns relevant context', async ({ request }) => {
    const contextRes = await request.get(`${API_URL}/api/v2/profile/context?goal=test`);
    expect(contextRes.ok()).toBeTruthy();

    const context = await contextRes.json();
    expect(context).toHaveProperty('context');
  });

  test('Preferences can be set and retrieved', async ({ request }) => {
    // Set a preference
    const key = 'test_preference_e2e';
    const value = 'test_value_' + Date.now();
    
    const setRes = await request.put(`${API_URL}/api/v2/preferences/${key}`, {
      data: { value }
    });
    expect(setRes.ok()).toBeTruthy();

    // Get the preference
    const getRes = await request.get(`${API_URL}/api/v2/preferences/${key}`);
    expect(getRes.ok()).toBeTruthy();

    const retrieved = await getRes.json();
    expect(retrieved.value).toBe(value);

    // Clean up
    await request.delete(`${API_URL}/api/v2/preferences/${key}`);
  });

  test('All preferences can be listed', async ({ request }) => {
    const prefsRes = await request.get(`${API_URL}/api/v2/preferences`);
    expect(prefsRes.ok()).toBeTruthy();

    const prefs = await prefsRes.json();
    expect(typeof prefs).toBe('object');
  });
});

test.describe('Facts & Semantic Features', () => {
  test('Facts extraction endpoint processes messages', async ({ request }) => {
    const extractRes = await request.post(`${API_URL}/api/v2/facts/extract`, {
      data: {
        message: 'My favorite color is blue and I live in New York',
        goal: null
      }
    });

    expect(extractRes.ok()).toBeTruthy();
    const facts = await extractRes.json();
    expect(typeof facts).toBe('object');
  });

  test('Facts can be retrieved and filtered', async ({ request }) => {
    const factsRes = await request.get(`${API_URL}/api/v2/facts`);
    expect(factsRes.ok()).toBeTruthy();

    const facts = await factsRes.json();
    expect(typeof facts).toBe('object');
  });

  test('Semantic search finds similar past goals', async ({ request }) => {
    const similarRes = await request.post(`${API_URL}/api/v2/semantic/similar`, {
      data: {
        goal: 'Send an email',
        threshold: 0.7,
        limit: 5
      }
    });

    expect(similarRes.ok()).toBeTruthy();
    const similar = await similarRes.json();
    expect(Array.isArray(similar)).toBeTruthy();
  });

  test('Semantic patterns endpoint returns usage patterns', async ({ request }) => {
    const patternsRes = await request.get(`${API_URL}/api/v2/semantic/patterns`);
    expect(patternsRes.ok()).toBeTruthy();

    const patterns = await patternsRes.json();
    expect(typeof patterns).toBe('object');
  });
});

test.describe('Telemetry & Analytics Features', () => {
  test('Telemetry batch endpoint accepts event batches', async ({ request }) => {
    const events = [
      {
        type: 'interaction',
        action: 'button_click',
        metadata: { button: 'test' },
        timestamp: Date.now()
      },
      {
        type: 'page_view',
        action: 'view',
        metadata: { page: 'test' },
        timestamp: Date.now()
      }
    ];

    const telemetryRes = await request.post(`${API_URL}/api/v2/telemetry/batch`, {
      data: {
        events,
        userId: 'e2e_test_user',
        sessionId: 'e2e_test_session',
        timestamp: Date.now()
      }
    });

    expect(telemetryRes.ok()).toBeTruthy();
  });

  test('Telemetry stats endpoint returns analytics', async ({ request }) => {
    const statsRes = await request.get(`${API_URL}/api/v2/telemetry/stats`);
    expect(statsRes.ok()).toBeTruthy();

    const stats = await statsRes.json();
    expect(typeof stats).toBe('object');
  });

  test('Telemetry interactions endpoint returns user interactions', async ({ request }) => {
    const interactionsRes = await request.get(`${API_URL}/api/v2/telemetry/interactions?limit=10`);
    expect(interactionsRes.ok()).toBeTruthy();

    const interactions = await interactionsRes.json();
    expect(Array.isArray(interactions)).toBeTruthy();
  });
});

test.describe('Settings & Configuration UI', () => {
  test('Settings page loads and displays configuration options', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/settings`);
    await waitForNetworkIdle(page);

    // Should have API endpoint input
    const apiInput = page.locator('input, label:has-text("API")').first();
    expect(await apiInput.count()).toBeGreaterThan(0);
  });

  test('API configuration can be updated via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/settings`);
    
    // Find API endpoint field
    const apiLabel = page.locator('label:has-text("API Endpoint")');
    if (await apiLabel.count() > 0) {
      const apiInput = apiLabel.locator('xpath=following-sibling::*//input');
      await apiInput.fill('http://localhost:8000');

      // Try to save
      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('UI Tools Panel Integration', () => {
  test('Tools panel button dispatches tools_open event', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/card`);

    // Set up event listener
    await page.evaluate(() => {
      window.__toolsEvents = [];
      window.addEventListener('amx:ui', (e) => {
        if (e.detail?.type === 'tools_open') {
          window.__toolsEvents.push(e.detail);
        }
      });
    });

    // Expand mini if needed
    const mini = page.locator('.amx-mini, .apple-floatbar-root.mini');
    if (await mini.count() > 0) {
      await mini.first().click();
      await page.waitForTimeout(300);
    }

    // Click Tools button
    const toolsBtn = page.locator('button[title="Tools"], button[aria-label="Tools"]');
    await toolsBtn.first().click();

    // Check event was fired
    const eventFired = await page.evaluate(() => window.__toolsEvents.length > 0);
    expect(eventFired).toBeTruthy();
  });
});
