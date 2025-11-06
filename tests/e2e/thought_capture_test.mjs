#!/usr/bin/env node
/**
 * Thought Capture Verification Test
 * 
 * Validates that the desktop app correctly captures AI thinking events from the backend.
 * Tests different query types that should trigger thinking/plan/step SSE events.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE = process.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';
const API_KEY = process.env.VITE_API_KEY || '';
const REPORTS_DIR = path.join(__dirname, '_reports');

// Test cases designed to trigger thinking events
const THOUGHT_TEST_CASES = [
  {
    name: 'complex_reasoning',
    message: 'If I have 3 apples and buy twice as many as I have, then give away half, how many do I have left? Explain your reasoning step by step.',
    mode: 'chat',
    expectThinking: true,
    minThinkingEvents: 1,
    description: 'Multi-step math problem that should trigger reasoning'
  },
  {
    name: 'planning_task',
    message: 'Create a plan to organize a small birthday party for 10 people',
    mode: 'chat',
    expectThinking: true,
    minThinkingEvents: 1,
    description: 'Planning task that should trigger structured thinking'
  },
  {
    name: 'autonomous_task',
    message: 'Research the current weather and plan my outfit accordingly',
    mode: 'autonomous',
    expectThinking: true,
    minThinkingEvents: 2,
    minPlanEvents: 1,
    minStepEvents: 1,
    description: 'Autonomous task that requires planning and execution'
  },
  {
    name: 'simple_question',
    message: 'What is 2 + 2?',
    mode: 'chat',
    expectThinking: false,
    maxThinkingEvents: 0,
    description: 'Simple question that should NOT trigger thinking (control case)'
  },
  {
    name: 'creative_task',
    message: 'Write a haiku about coding. First, think about what makes a good haiku, then write one.',
    mode: 'chat',
    expectThinking: true,
    minThinkingEvents: 1,
    description: 'Creative task with explicit reasoning request'
  }
];

// SSE event parser
function parseSSEEvent(line) {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch (e) {
    console.error('Failed to parse SSE line:', line, e);
    return null;
  }
}

async function runThoughtTest(testCase) {
  const endpoint = testCase.mode === 'autonomous'
    ? `${API_BASE}/api/v2/autonomous/execute/stream`
    : `${API_BASE}/api/v2/chat/streaming/stream`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  const payload = {
    message: testCase.message,
    conversation_id: `thought_test_${testCase.name}_${Date.now()}`,
    user_id: 'thought_test_user'
  };

  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Mode: ${testCase.mode}`);
  console.log(`   Query: "${testCase.message}"`);
  console.log(`   Expect thinking: ${testCase.expectThinking}`);

  const startTime = Date.now();
  const events = {
    ack: 0,
    thinking: 0,
    plan: 0,
    step: 0,
    token: 0,
    done: 0,
    error: 0
  };
  const thinkingContent = [];
  const planContent = [];
  const stepContent = [];

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body;
    let buffer = '';

    for await (const chunk of reader) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseSSEEvent(line);
        if (!event) continue;

        events[event.type] = (events[event.type] || 0) + 1;

        if (event.type === 'thinking') {
          const msg = event.data?.message || event.message || '';
          thinkingContent.push(msg);
        } else if (event.type === 'plan') {
          planContent.push(event.data || event);
        } else if (event.type === 'step') {
          stepContent.push(event.data || event);
        } else if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }

      if (events.done > 0 || events.error > 0) break;
    }
  } catch (error) {
    console.error(`   ❌ Request failed:`, error.message);
    return {
      testCase: testCase.name,
      passed: false,
      error: error.message,
      events,
      duration: Date.now() - startTime
    };
  }

  const duration = Date.now() - startTime;

  // Validation
  let passed = true;
  const failures = [];

  if (testCase.expectThinking && events.thinking < (testCase.minThinkingEvents || 1)) {
    passed = false;
    failures.push(`Expected at least ${testCase.minThinkingEvents || 1} thinking events, got ${events.thinking}`);
  }

  if (!testCase.expectThinking && testCase.maxThinkingEvents !== undefined && events.thinking > testCase.maxThinkingEvents) {
    passed = false;
    failures.push(`Expected max ${testCase.maxThinkingEvents} thinking events, got ${events.thinking}`);
  }

  if (testCase.minPlanEvents && events.plan < testCase.minPlanEvents) {
    passed = false;
    failures.push(`Expected at least ${testCase.minPlanEvents} plan events, got ${events.plan}`);
  }

  if (testCase.minStepEvents && events.step < testCase.minStepEvents) {
    passed = false;
    failures.push(`Expected at least ${testCase.minStepEvents} step events, got ${events.step}`);
  }

  if (events.done === 0 && events.error === 0) {
    passed = false;
    failures.push('Stream did not complete (no done or error event)');
  }

  const result = {
    testCase: testCase.name,
    description: testCase.description,
    mode: testCase.mode,
    passed,
    failures,
    events,
    thinkingContent,
    planContent: planContent.length > 0 ? planContent : undefined,
    stepContent: stepContent.length > 0 ? stepContent : undefined,
    duration,
    timestamp: new Date().toISOString()
  };

  // Log result
  const icon = passed ? '✅' : '❌';
  console.log(`   ${icon} ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`   Events: thinking=${events.thinking}, plan=${events.plan}, step=${events.step}, tokens=${events.token}`);
  if (!passed) {
    failures.forEach(f => console.log(`      - ${f}`));
  }
  if (thinkingContent.length > 0) {
    console.log(`   Thinking samples:`);
    thinkingContent.slice(0, 2).forEach(t => console.log(`      - "${t.substring(0, 60)}${t.length > 60 ? '...' : ''}"`));
  }

  return result;
}

async function main() {
  console.log('🧠 Thought Capture Verification Test');
  console.log('=====================================');
  console.log(`API: ${API_BASE}`);
  console.log(`Test cases: ${THOUGHT_TEST_CASES.length}`);

  // Ensure reports directory exists
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const results = [];
  for (const testCase of THOUGHT_TEST_CASES) {
    const result = await runThoughtTest(testCase);
    results.push(result);
    // Small delay between tests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testCase}: ${r.failures.join('; ')}`);
    });
  }

  // Save report
  const reportFile = path.join(REPORTS_DIR, `thought_capture_${new Date().toISOString().replace(/:/g, '-')}.json`);
  await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Report saved: ${reportFile}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
