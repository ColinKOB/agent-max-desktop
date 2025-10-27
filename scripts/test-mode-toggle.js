#!/usr/bin/env node
/**
 * Mode Toggle E2E Test (frontend-side)
 * - Calls the same streaming endpoint the desktop app uses
 * - Verifies capability differences across Chatty, Helpful, Autonomous
 * - Writes a Markdown report to test-results/
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:8000';
const ENDPOINT = `${API_BASE}/api/v2/chat/streaming/stream`;

function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function streamRequest({ message, mode = 'helpful', conversationId = `test_${mode}` }) {
  const payload = {
    message,
    conversation_id: conversationId,
    max_tokens: 1200,
    temperature: 0.7,
    stream: true,
    memory_mode: 'auto',
    mode,
  };

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'dev',
      'X-User-Id': 'mode_tester'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

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
      // Only try JSON objects/arrays
      const first = data[0];
      if (first !== '{' && first !== '[') continue;
      try {
        const evt = JSON.parse(data);
        if (evt.type === 'content' && typeof evt.content === 'string') {
          full += evt.content;
        } else if (evt.type === 'token' && typeof evt.content === 'string') {
          full += evt.content;
        } else if (evt.type === 'done') {
          // try to extract final text from common keys
          const d = evt.data || evt || {};
          const candidates = [
            d.final_response, d.final, d.response, d.text, d.content, d.message, d.result, d.answer, d.output,
            d?.choices?.[0]?.message?.content,
            d?.choices?.[0]?.delta?.content,
            d?.data?.text,
            d?.data?.content
          ].filter((v) => typeof v === 'string' && v.trim());
          if (candidates.length) full += candidates[0];
        }
      } catch {}
    }
  }

  return full;
}

function analyzeHelpful(text) {
  const t = text.toLowerCase();
  const mentions = {
    gmail: t.includes('gmail'),
    calendar: t.includes('calendar'),
    google: t.includes('google') || t.includes('docs') || t.includes('sheets'),
    browser: t.includes('browser') || t.includes('website')
  };
  const forbidden = {
    'file system': t.includes('file system') || (t.includes('file') && t.includes('access')),
    shell: t.includes('shell') || t.includes('terminal') || t.includes('command'),
  };
  const ok = Object.values(mentions).filter(Boolean).length >= 2 && !Object.values(forbidden).some(Boolean);
  return { ok, mentions, forbidden };
}

function analyzeAutonomous(text) {
  const t = text.toLowerCase();
  const wants = {
    file: t.includes('file') || t.includes('create') || t.includes('fs.'),
    shell: t.includes('shell') || t.includes('command') || t.includes('terminal') || t.includes('npm') || t.includes('git'),
    browser: t.includes('browser') || t.includes('selenium')
  };
  const ok = Object.values(wants).filter(Boolean).length >= 2;
  return { ok, wants };
}

async function main() {
  const outDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];

  console.log('=== Mode Toggle E2E Test (frontend) ===');
  console.log('Endpoint:', ENDPOINT);

  // Chatty test
  const chattyMsg = 'Create a file on my Desktop and put a note inside.';
  const chattyText = await streamRequest({ message: chattyMsg, mode: 'chatty' }).catch(e => `ERROR: ${e.message}`);
  report.push({ mode: 'chatty', prompt: chattyMsg, chars: chattyText.length, snippet: chattyText.slice(0, 800) });
  console.log('\n[chatty] len=', chattyText.length);

  // Helpful test
  const helpfulMsg = 'What can you do? List your capabilities.';
  const helpfulText = await streamRequest({ message: helpfulMsg, mode: 'helpful' }).catch(e => `ERROR: ${e.message}`);
  const helpfulCheck = analyzeHelpful(helpfulText);
  report.push({ mode: 'helpful', prompt: helpfulMsg, chars: helpfulText.length, ok: helpfulCheck.ok, details: helpfulCheck, snippet: helpfulText.slice(0, 800) });
  console.log('[helpful] len=', helpfulText.length, 'ok=', helpfulCheck.ok);

  // Autonomous test
  const autoMsg = 'What can you do? Be specific about system access and coding.';
  const autoText = await streamRequest({ message: autoMsg, mode: 'autonomous' }).catch(e => `ERROR: ${e.message}`);
  const autoCheck = analyzeAutonomous(autoText);
  report.push({ mode: 'autonomous', prompt: autoMsg, chars: autoText.length, ok: autoCheck.ok, details: autoCheck, snippet: autoText.slice(0, 800) });
  console.log('[autonomous] len=', autoText.length, 'ok=', autoCheck.ok);

  // Write Markdown report
  const md = [
    `# Mode Toggle E2E Test (Frontend)`,
    `Date: ${new Date().toISOString()}`,
    `Endpoint: ${ENDPOINT}`,
    '',
    ...report.map(r => [
      `## ${r.mode.toUpperCase()}`,
      `- Prompt: ${r.prompt}`,
      `- Length: ${r.chars}`,
      r.ok !== undefined ? `- Check: ${r.ok ? 'PASS' : 'FAIL'}` : null,
      r.details ? `- Details: ${JSON.stringify(r.details)}` : null,
      '',
      '### Snippet',
      '```',
      r.snippet || '',
      '```',
      ''
    ].filter(Boolean).join('\n'))
  ].join('\n');

  const file = path.join(outDir, `mode_toggle_${nowStamp()}.md`);
  fs.writeFileSync(file, md, 'utf-8');
  console.log('\nReport saved to:', file);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
