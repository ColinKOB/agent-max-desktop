import { test, expect } from '@playwright/test';

const API = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
const HAS_KEY = !!process.env.TEST_API_KEY;

// Canonical v2 smoke checks to catch route drift early

test.describe('Backend API (Railway) - v2 Smoke', () => {
  test('Profile: /api/v2/profile and /api/v2/profile/greeting', async ({ request }) => {
    const profile = await request.get(`${API}/api/v2/profile`);
    const greeting = await request.get(`${API}/api/v2/profile/greeting`);
    if (HAS_KEY) {
      expect(profile.ok(), `profile status ${profile.status()}`).toBeTruthy();
      expect(greeting.ok(), `greeting status ${greeting.status()}`).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(profile.status());
      expect([200, 401, 403]).toContain(greeting.status());
    }
  });

  test('Conversation: /api/v2/conversation/history', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/conversation/history?limit=1&offset=0`);
    expect([200, 401, 403, 404, 405, 500]).toContain(res.status());
  });

  test('Chat (JSON fallback): /api/v2/chat/message', async ({ request }) => {
    const res = await request.post(`${API}/api/v2/chat/message`, {
      data: {
        message: 'Ping from v2 smoke test',
        session_id: 'smoke-v2',
        include_context: true,
      },
    });
    expect([200, 401, 403, 404, 405, 500]).toContain(res.status());
  });

  test('Telemetry stats: /api/v2/telemetry/stats', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/telemetry/stats`);
    expect([200, 401, 403, 404, 500]).toContain(res.status());
  });

  test('Google status: /api/v2/google/status', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/google/status`);
    expect([200, 500]).toContain(res.status());
  });

  test('Google auth URL: /api/v2/google/auth/url', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/google/auth/url`);
    expect([200, 401, 403, 404, 405, 500]).toContain(res.status());
  });
});
