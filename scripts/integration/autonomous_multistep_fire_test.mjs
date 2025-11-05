#!/usr/bin/env node
/*
 * Autonomous Multi-step Fire Test (Railway backend)
 * - Targets hosted Agent_Max at API_URL (or .env.production)
 * - Exercises multi-step autonomous reasoning with SSE events
 * - Logs all events and metrics to tests/e2e/_reports/autonomous_multistep_<timestamp>.jsonl
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
  } catch (_) {}
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
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = path.join(REPORT_DIR, `autonomous_multistep_${STAMP}.jsonl`);

function logLine(obj) {
  fs.appendFileSync(REPORT_PATH, JSON.stringify({ timestamp: Date.now(), ...obj }) + '\n', 'utf8');
}

async function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function streamAutonomous(name, goal) {
  const endpoint = `${API_URL}/api/v2/autonomous/execute/stream`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'X-API-Key': TEST_API_KEY,
    'X-User-Id': 'fire-tester'
  };
  const payload = {
    goal,
    mode: 'autonomous',
    user_context: null,
    max_steps: 10,
    timeout: 300
  };

  logLine({ type: 'case.start', name, endpoint });
  const startedAt = Date.now();
  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logLine({ type: 'case.error', name, status: res.status, body: body.slice(0, 500) });
    // Honor rate limits if provided
    if (res.status === 429) {
      try {
        const parsed = JSON.parse(body);
        const waitSec = Number(parsed?.retry_after || 60);
        logLine({ type: 'case.backoff', name, wait_seconds: waitSec });
        await delay((waitSec + 5) * 1000);
        // single retry
        logLine({ type: 'case.retry', name });
        return await streamAutonomous(name, goal);
      } catch (_) {}
    }
    return { ok: false, status: res.status };
  }

  let firstEventAt = 0;
  let steps = 0;
  let tokens = 0;
  let planSeen = false;
  let final = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const first = data[0];
      if (first !== '{' && first !== '[') continue;
      try {
        const parsed = JSON.parse(data);
        if (!firstEventAt) firstEventAt = Date.now();
        const et = parsed.type || 'event';
        const payload = parsed.data || (() => { const { type, id, ...rest } = parsed; return rest; })();
        if (et === 'plan') planSeen = true;
        if (et === 'step') {
          steps = Math.max(steps, payload.step_number || payload.step || 0);
          if (payload.result && typeof payload.result === 'string') tokens += payload.result.length;
        }
        if (et === 'done' || et === 'complete') {
          final = (payload && (payload.final_response || payload.response)) || final;
        }
        logLine({ type: 'sse', name, event: et, payload });
      } catch (e) {
        logLine({ type: 'sse_parse_error', name, error: String(e?.message || e), raw: data.slice(0, 200) });
      }
    }
  }

  const ended = Date.now();
  const ttff = firstEventAt ? firstEventAt - startedAt : -1;
  logLine({ type: 'case.done', name, ttff_ms: ttff, duration_ms: ended - startedAt, steps, token_chars: tokens, plan_seen: planSeen, has_final: !!final });
  return { ok: true, steps, planSeen, finalLen: final.length, ttff, total: ended - startedAt };
}

async function main() {
  console.log(`🧪 Autonomous Multi-step Fire Test -> ${API_URL}`);
  console.log(`Report: ${path.relative(repoRoot, REPORT_PATH)}`);

  const cases = [
    { name: 'trip_planning_constraints', goal: 'Plan a two-day trip to NYC with a $500 budget, include transport, food, and 3 attractions per day. Output clear numbered steps.' },
    { name: 'data_cleaning_pipeline', goal: 'Outline a 6-step data cleaning pipeline for a CSV with missing values, duplicates, and mixed types. Include rationale per step.' },
    { name: 'feature_launch_checklist', goal: 'Create a 7-step launch plan for a SaaS feature release with staged rollout and rollback plan.' },
    { name: 'study_schedule', goal: 'Build a 5-step weekly study schedule for a beginner learning TypeScript and React with 8 hours available.' },
    { name: 'debugging_strategy', goal: 'Provide a 6-step debugging strategy for flaky end-to-end tests with intermittent network errors.' }
  ];

  logLine({ type: 'session.start', api_url: API_URL });
  const results = [];
  for (const c of cases) {
    const r = await streamAutonomous(c.name, c.goal).catch(e => ({ ok: false, error: String(e?.message || e) }));
    results.push({ name: c.name, ...r });
    // small spacing between cases to avoid tripping global rate limits
    await delay(1500);
  }
  logLine({ type: 'session.end', results });

  console.log('\nSummary:');
  for (const r of results) {
    console.log(`- ${r.name}: ${r.ok ? 'OK' : 'FAIL'} steps=${r.steps ?? '?'} ttff=${r.ttff ?? '?'}ms total=${r.total ?? '?'}ms finalLen=${r.finalLen ?? 0}`);
  }

  const anyFail = results.some(r => !r.ok || (r.steps || 0) < 1);
  process.exit(anyFail ? 2 : 0);
}

main().catch(e => { console.error('❌ Unhandled error:', e); process.exit(1); });
