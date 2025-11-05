#!/usr/bin/env node
/*
 * Chat Stream Fire Test (Railway backend)
 * - Targets the hosted Agent_Max backend only (no local server)
 * - Uses the same endpoints/headers the desktop UI uses
 * - Exercises both chat streaming and autonomous streaming (if available)
 * - Logs every SSE event and final results to tests/e2e/_reports/chat_fire_test_<timestamp>.jsonl
 *
 * Env vars (optional):
 *   API_URL       - e.g. https://agentmax-production.up.railway.app
 *   TEST_API_KEY  - API key for X-API-Key header
 * If not provided, falls back to reading .env.production (VITE_API_URL, VITE_API_KEY)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../');

function loadEnvProduction() {
  const envPath = path.join(repoRoot, '.env.production');
  let apiUrl = null;
  let apiKey = null;
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m1 = line.match(/^VITE_API_URL=(.*)$/);
      if (m1) apiUrl = m1[1].trim();
      const m2 = line.match(/^VITE_API_KEY=(.*)$/);
      if (m2) apiKey = m2[1].trim();
    }
  } catch (_) {
    // ignore
  }
  return { apiUrl, apiKey };
}

const { apiUrl: envApiUrl, apiKey: envApiKey } = loadEnvProduction();
const API_URL = (process.env.API_URL || envApiUrl || '').replace(/\/$/, '');
const TEST_API_KEY = process.env.TEST_API_KEY || envApiKey || '';

if (!API_URL) {
  console.error('❌ API_URL not set and .env.production missing VITE_API_URL.');
  process.exit(1);
}

if (!TEST_API_KEY) {
  console.error('❌ TEST_API_KEY not set and .env.production missing VITE_API_KEY.');
  process.exit(1);
}

const REPORT_DIR = path.join(repoRoot, 'tests', 'e2e', '_reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });
const START_TS = new Date();
const STAMP = START_TS.toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = path.join(REPORT_DIR, `chat_fire_test_${STAMP}.jsonl`);

function logLine(obj) {
  fs.appendFileSync(REPORT_PATH, JSON.stringify({ timestamp: Date.now(), ...obj }) + '\n', 'utf8');
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

function buildEndpoints(isAutonomous, base, disableLegacyFallbacks) {
  const b = base.replace(/\/$/, '');
  if (isAutonomous) {
    return disableLegacyFallbacks
      ? [ `${b}/api/v2/autonomous/execute/stream` ]
      : [
          `${b}/api/v2/autonomous/execute/stream`,
          `${b}/api/autonomous/execute/stream`,
          `${b}/api/v2/autonomous/stream`,
          `${b}/api/autonomous/stream`
        ];
  }
  return disableLegacyFallbacks
    ? [ `${b}/api/v2/chat/streaming/stream` ]
    : [
        `${b}/api/v2/chat/streaming/stream`,
        `${b}/api/chat/streaming/stream`,
        `${b}/api/v2/chat/stream`,
        `${b}/api/chat/stream`,
        `${b}/api/v2/chat/streaming`,
        `${b}/api/chat/streaming`
      ];
}

async function streamOnce({ name, mode, message }) {
  const isAutonomous = mode === 'autonomous';
  const disableLegacyFallbacks = true; // surface drift; mirrors prod default in UI
  const endpoints = buildEndpoints(isAutonomous, API_URL, disableLegacyFallbacks);

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'X-User-Id': 'fire-tester',
    'X-API-Key': TEST_API_KEY,
  };

  const payload = isAutonomous ? {
    goal: message,
    mode,
    user_context: null,
    max_steps: 5,
    timeout: 120,
  } : {
    message,
    context: null,
    max_tokens: 512,
    temperature: 0.7,
    stream: true,
    memory_mode: 'auto',
    mode,
  };

  const startedAt = Date.now();
  logLine({ type: 'case.start', name, mode, API_URL, endpoint_candidates: endpoints });

  let response = null;
  let lastStatus = 0;
  let lastBody = '';
  for (const ep of endpoints) {
    logLine({ type: 'case.try_endpoint', name, endpoint: ep });
    try {
      response = await fetch(ep, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    } catch (e) {
      lastStatus = 0;
      lastBody = String(e?.message || e);
      logLine({ type: 'case.network_error', name, endpoint: ep, error: lastBody });
      continue;
    }

    if (response.ok) {
      logLine({ type: 'case.endpoint_selected', name, endpoint: ep, status: response.status });
      break;
    }
    lastStatus = response.status;
    try { lastBody = await response.text(); } catch {}
    logLine({ type: 'case.endpoint_failed', name, endpoint: ep, status: lastStatus, body: lastBody?.slice(0, 500) });
    if ([404, 405].includes(lastStatus)) continue;
    if (lastStatus === 401) break;
  }

  if (!response || !response.ok) {
    // Try JSON fallback for chat (non-streaming)
    if (!isAutonomous) {
      const jsonEp = `${API_URL}/api/v2/chat/message`;
      try {
        const jsonResp = await fetch(jsonEp, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-User-Id': 'fire-tester', 'X-API-Key': TEST_API_KEY },
          body: JSON.stringify({ message, session_id: 'fire-test', include_context: true })
        });
        const json = await jsonResp.json().catch(() => ({}));
        logLine({ type: 'case.json_fallback', name, endpoint: jsonEp, status: jsonResp.status, body: json });
        return { ok: jsonResp.ok, status: jsonResp.status, usedFallback: true };
      } catch (e) {
        logLine({ type: 'case.json_fallback_error', name, error: String(e?.message || e) });
      }
    }
    logLine({ type: 'case.failed', name, status: lastStatus, error: lastBody?.slice(0, 500) });
    return { ok: false, status: lastStatus || (response && response.status) || 0 };
  }

  let firstEventAt = 0;
  let tokenChars = 0;
  let eventCount = 0;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        const firstChar = data[0];
        if (firstChar !== '{' && firstChar !== '[') continue;
        try {
          const parsed = JSON.parse(data);
          if (!firstEventAt) firstEventAt = Date.now();
          eventCount++;
          // Normalize for autonomous vs chat
          if (mode === 'autonomous') {
            const et = parsed.type || 'event';
            const payload = parsed.data || (() => { const { type, id, ...rest } = parsed; return rest; })();
            if (payload?.result && typeof payload.result === 'string') tokenChars += payload.result.length;
            logLine({ type: 'sse', name, event: et, payload });
          } else {
            const content = parsed?.content || parsed?.delta || parsed?.token || parsed?.text || '';
            if (typeof content === 'string') tokenChars += content.length;
            logLine({ type: 'sse', name, event: parsed.event || 'token', payload: parsed });
          }
        } catch (e) {
          logLine({ type: 'sse_parse_error', name, error: String(e?.message || e), raw: data.slice(0, 200) });
        }
      }
    }
  }

  const finishedAt = Date.now();
  const ttff = firstEventAt ? (firstEventAt - startedAt) : -1; // time to first token
  const total = finishedAt - startedAt;

  logLine({ type: 'case.done', name, ttff_ms: ttff, duration_ms: total, token_chars: tokenChars, events: eventCount });
  return { ok: true, status: 200, ttff, total, tokens: tokenChars, events: eventCount };
}

async function main() {
  console.log(`🧪 Chat Stream Fire Test -> ${API_URL}`);
  console.log(`Report: ${path.relative(repoRoot, REPORT_PATH)}`);

  const cases = [
    { name: 'basic_math_chat', mode: 'helpful', message: 'What is 17 * 23? Please just give the number.' },
    { name: 'reasoning_short', mode: 'helpful', message: 'Explain in 2 sentences why the sky is blue.' },
    { name: 'planning', mode: 'helpful', message: 'Plan a simple 3-step morning routine.' },
    { name: 'long_context', mode: 'helpful', message: `Summarize the following in one paragraph:\n${'Lorem ipsum dolor sit amet, '.repeat(150)}` },
    { name: 'autonomous_simple', mode: 'autonomous', message: 'Draft a concise checklist for launching a new app version. Keep it to 5 items.' },
  ];

  logLine({ type: 'session.start', api_url: API_URL, started_at: START_TS.toISOString() });

  const results = [];
  for (const c of cases) {
    const r = await streamOnce(c).catch(e => ({ ok: false, error: String(e?.message || e) }));
    results.push({ name: c.name, ...r });
    await delay(250); // brief gap between tests
  }

  logLine({ type: 'session.end', ended_at: new Date().toISOString(), results });

  // Console summary
  console.log('\nSummary:');
  for (const r of results) {
    const status = r.ok ? 'OK' : `FAIL(${r.status || 'ERR'})`;
    const extra = r.ok ? `ttff=${r.ttff}ms total=${r.total}ms events=${r.events}` : '';
    console.log(`- ${r.name}: ${status} ${extra}`);
  }

  const anyFail = results.some(r => !r.ok);
  process.exit(anyFail ? 2 : 0);
}

main().catch(e => {
  console.error('❌ Unhandled error:', e);
  process.exit(1);
});
