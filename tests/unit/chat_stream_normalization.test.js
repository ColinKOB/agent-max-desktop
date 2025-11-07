import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock telemetry to avoid side effects
vi.mock('../../src/services/telemetry', () => ({ default: { logEvent: vi.fn() } }));

// Provide a minimal window + localStorage for api.js
global.window = {
  dispatchEvent: vi.fn(),
};

global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

// Helper to build a Response-like object with a streaming body
function buildSSEStream(events) {
  const encoder = new TextEncoder();
  const chunks = events.map((evt) => {
    const line = `data: ${JSON.stringify(evt)}\n\n`;
    return encoder.encode(line);
  });
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (i < chunks.length) {
              const value = chunks[i++];
              return { done: false, value };
            }
            return { done: true, value: undefined };
          },
        };
      },
    },
  };
}

// Import after globals/mocks are in place
import { chatAPI } from '../../src/services/api';

describe('chatAPI.sendMessageStream normalization', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('normalizes agent stream (v1.1) final/done to data.final_response', async () => {
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 1 } },
      { type: 'plan', data: { steps: ['a', 'b'] } },
      { type: 'token', data: { content: 'Hello ' } },
      { type: 'token', data: { content: 'world' } },
      { type: 'final', data: { final_response: 'Hello world' } },
      { type: 'done', data: { final_response: 'Hello world' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    const events = [];
    await chatAPI.sendMessageStream('Say hello', { __mode: 'autonomous' }, null, (evt) => {
      events.push(evt);
    });

    const types = events.map((e) => e.type);
    expect(types).toContain('ack');
    expect(types).toContain('plan');
    expect(types).toContain('token');
    expect(types).toContain('final');
    expect(types).toContain('done');

    const finalEvt = events.find((e) => e.type === 'final');
    expect(finalEvt).toBeTruthy();
    expect(finalEvt.data).toBeTruthy();
    expect(finalEvt.data.final_response).toBe('Hello world');

    const doneEvt = events.find((e) => e.type === 'done');
    expect(doneEvt).toBeTruthy();
    expect(doneEvt.data).toBeTruthy();
    expect(doneEvt.data.final_response).toBe('Hello world');
  });

  it('normalizes autonomous Phase 3 complete/done (top-level final_response) to data.final_response', async () => {
    const sse = buildSSEStream([
      { type: 'thinking', message: 'Planning...' },
      { type: 'complete', final_response: 'Answer ready' },
      { type: 'done', final_response: 'Answer ready' },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    const events = [];
    await chatAPI.sendMessageStream('Do task', { __mode: 'autonomous' }, null, (evt) => {
      events.push(evt);
    });

    const types = events.map((e) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('final');
    expect(types).toContain('done');

    const finalEvt = events.find((e) => e.type === 'final');
    expect(finalEvt).toBeTruthy();
    expect(finalEvt.data.final_response).toBe('Answer ready');

    const doneEvt = events.find((e) => e.type === 'done');
    expect(doneEvt).toBeTruthy();
    expect(doneEvt.data.final_response).toBe('Answer ready');
  });

  it('accepts `event` alias for `type` and uses POST with expected headers in autonomous mode', async () => {
    const sse = buildSSEStream([
      { event: 'thinking', message: 'Processing' },
      { event: 'complete', final_response: 'Alias works' },
      { event: 'done', final_response: 'Alias works' },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    const events = [];
    await chatAPI.sendMessageStream('Alias test', { __mode: 'autonomous' }, null, (evt) => {
      events.push(evt);
    });

    // Verify event normalization
    const types = events.map((e) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('final');
    expect(types).toContain('done');
    const finalEvt = events.find((e) => e.type === 'final');
    expect(finalEvt.data.final_response).toBe('Alias works');
    const doneEvt = events.find((e) => e.type === 'done');
    expect(doneEvt.data.final_response).toBe('Alias works');

    // Verify fetch was called with POST and streaming Accept header only
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Accept']).toBe('text/event-stream');
    expect(options.headers['X-Events-Version']).toBeUndefined();
  });

  it('handles v2.1 metadata and surfaces final metrics', async () => {
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 1 } },
      { type: 'metadata', data: { key: 'resume_unavailable' } },
      { type: 'final', data: { final_response: 'ok', tokens_out: 37, total_ms: 1234, tokens_in: 55, cost_usd: 0.0012, checksum: 'abc' } },
      { type: 'done', data: { final_response: 'ok', tokens_out: 37, total_ms: 1234, tokens_in: 55, cost_usd: 0.0012, checksum: 'abc' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    const events = [];
    await chatAPI.sendMessageStream('v2.1 test', { __mode: 'autonomous' }, null, (evt) => {
      events.push(evt);
    });

    const types = events.map((e) => e.type);
    expect(types).toContain('metadata');
    const finalEvt = events.find((e) => e.type === 'final');
    const doneEvt = events.find((e) => e.type === 'done');
    expect(finalEvt.data.final_response).toBe('ok');
    expect(doneEvt.data.final_response).toBe('ok');
    expect(finalEvt.data.tokens_out).toBe(37);
    expect(finalEvt.data.total_ms).toBe(1234);
    expect(finalEvt.data.tokens_in).toBe(55);
    expect(finalEvt.data.cost_usd).toBeCloseTo(0.0012);
    expect(finalEvt.data.checksum).toBe('abc');
  });

  it('sends v2.1 resume headers when provided', async () => {
    const sse = buildSSEStream([
      { type: 'ack' },
      { type: 'done', data: { final_response: 'r' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    const resume = { streamId: 'stream-xyz', lastSequenceSeen: 42 };
    const events = [];
    await chatAPI.sendMessageStream('resume', { __mode: 'autonomous', __resume: resume }, null, (evt) => {
      events.push(evt);
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['X-Stream-Id']).toBe('stream-xyz');
    expect(options.headers['Last-Sequence-Seen']).toBe('42');
  });
});
