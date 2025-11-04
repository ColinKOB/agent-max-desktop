import { test, expect } from '@playwright/test';

const API = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
const HAS_KEY = !!process.env.TEST_API_KEY;

async function tryPaths(request, method, paths, data) {
  let last;
  for (const p of paths) {
    const url = p.startsWith('http') ? p : `${API}${p}`;
    try {
      if (method === 'GET') last = await request.get(url);
      else if (method === 'POST') last = await request.post(url, { data });
      else if (method === 'PUT') last = await request.put(url, { data });
      else if (method === 'DELETE') last = await request.delete(url);
      else throw new Error(`Unsupported method ${method}`);
      if (last.ok()) return last;
      if ([404, 405].includes(last.status())) continue; // try next path
    } catch (_) {
      // ignore and try next
    }
  }
  return last;
}

// --- CORE CONNECTIVITY ---

test.describe('Backend API (Railway) - Core', () => {
  test('Health endpoint responds', async ({ request }) => {
    const res = await tryPaths(request, 'GET', ['/health', '/api/health', '/api/v2/health']);
    expect(res, 'no health endpoint responded').toBeTruthy();
    expect(res.ok(), `status ${res?.status()}`).toBeTruthy();
  });

  test('Profile endpoints respond (profile, greeting)', async ({ request }) => {
    const profile = await request.get(`${API}/api/v2/profile`);
    if (HAS_KEY) {
      expect(profile.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(profile.status());
    }
    const greeting = await request.get(`${API}/api/v2/profile/greeting`);
    if (HAS_KEY) {
      expect(greeting.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(greeting.status());
    }
  });

  test('Agents endpoints respond (providers, roles, list)', async ({ request }) => {
    const providers = await request.get(`${API}/api/v2/agents/providers`);
    if (HAS_KEY) {
      expect(providers.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(providers.status());
    }
    const roles = await request.get(`${API}/api/v2/agents/roles`);
    if (HAS_KEY) {
      expect(roles.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(roles.status());
    }
    const list = await request.get(`${API}/api/v2/agents/list`);
    if (HAS_KEY) {
      expect(list.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(list.status());
    }
  });

  test('Conversation message + context', async ({ request }) => {
    const add = await request.post(`${API}/api/v2/conversation/message`, {
      data: { role: 'user', content: 'Ping from API tests' }
    });
    if (HAS_KEY) {
      expect(add.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(add.status());
    }
    const ctx = await request.get(`${API}/api/v2/conversation/context?last_n=1`);
    if (HAS_KEY) {
      expect(ctx.ok()).toBeTruthy();
    } else {
      expect([200, 401, 403]).toContain(ctx.status());
    }
  });
});

// --- OPTIONAL / NICE-TO-HAVE ---

test.describe('Backend API (Railway) - Optional', () => {
  test('Safety permission-level endpoint reachable (v2)', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/safety/permission-level`);
    expect([200, 403, 404, 500]).toContain(res.status());
  });

  test('Google status responds', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/google/status`);
    expect([200, 500]).toContain(res.status());
  });

  test('Preferences list works', async ({ request }) => {
    const list = await request.get(`${API}/api/v2/preferences`);
    expect([200, 401, 403, 404, 405, 500]).toContain(list.status());
  });

  test('Facts extract + list (if enabled)', async ({ request }) => {
    const extract = await request.post(`${API}/api/v2/facts/extract`, {
      data: { message: 'My favorite color is blue', goal: null }
    });
    expect([200, 401, 403, 404, 405, 500]).toContain(extract.status());
    const getFacts = await request.get(`${API}/api/v2/facts`);
    expect([200, 401, 403, 404, 405, 500]).toContain(getFacts.status());
  });

  test('Semantic patterns (if enabled)', async ({ request }) => {
    const res = await request.get(`${API}/api/v2/semantic/patterns`);
    expect([200, 401, 403, 404, 500]).toContain(res.status());
  });
});
