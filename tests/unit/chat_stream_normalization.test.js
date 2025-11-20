import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock telemetry to avoid side effects
vi.mock('../../src/services/telemetry', () => ({ default: { logEvent: vi.fn() } }));

// Provide a minimal window + localStorage for api.js
const mockExecuteRequest = vi.fn();
const mockDesktopStatus = vi.fn(() => Promise.resolve({ enabled: true, connected: true }));
global.window = {
  dispatchEvent: vi.fn(),
  electron: {
    handsOnDesktop: {
      executeRequest: (...args) => mockExecuteRequest(...args),
      status: (...args) => mockDesktopStatus(...args),
      toggle: vi.fn(),
    },
  },
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

function buildFailingSSEStream(events, failAtIndex = 0, error = new TypeError('stream error')) {
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
            if (i === failAtIndex) {
              throw error;
            }
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
import { chatAPI, __testHooks as apiTestHooks } from '../../src/services/api';

describe('chatAPI.sendMessageStream normalization', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    mockExecuteRequest.mockReset();
    mockExecuteRequest.mockResolvedValue(undefined);
    mockDesktopStatus.mockClear();
    mockDesktopStatus.mockResolvedValue({ enabled: true, connected: true });
    if (global.window?.dispatchEvent?.mockReset) {
      global.window.dispatchEvent.mockReset();
    }
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    apiTestHooks?.resetHandsOnDesktopState?.();
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
    expect(options.headers['X-Events-Version']).toBe('2.1');
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

  it('retries the same endpoint when fetch reports a transient network change', async () => {
    const networkErr = new TypeError('Failed to fetch: net::ERR_NETWORK_CHANGED');
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 123 } },
      { type: 'done', data: { final_response: 'Recovered after retry' } },
    ]);
    fetchSpy
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValueOnce(sse);

    const events = [];
    await chatAPI.sendMessageStream('retry network', { __mode: 'autonomous' }, null, (evt) => {
      events.push(evt);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/v2/agent/execute/stream');
    expect(fetchSpy.mock.calls[1][0]).toContain('/api/v2/agent/execute/stream');
    const doneEvt = events.find((evt) => evt.type === 'done');
    expect(doneEvt).toBeTruthy();
    expect(doneEvt.data.final_response).toBe('Recovered after retry');
  });

  it('sets server_fs flag to false when hands-on desktop is available', async () => {
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 55 } },
      { type: 'done', data: { final_response: 'ok' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    await chatAPI.sendMessageStream('Write a file', { __mode: 'autonomous' }, null, () => {});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.flags).toBeDefined();
    expect(body.flags.server_fs).toBe(false);
  });

  it('includes desktop bridge connectivity flag when helper is online', async () => {
    mockDesktopStatus.mockResolvedValueOnce({ enabled: true, connected: true });
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 42 } },
      { type: 'done', data: { final_response: 'ok' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    await chatAPI.sendMessageStream('Desktop online test', { __mode: 'autonomous' }, null, () => {});

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.flags).toBeDefined();
    expect(body.flags.server_fs).toBe(false);
    expect(body.flags.desktop_bridge_connected).toBe(true);
  });

  it('falls back to server_fs when desktop bridge is disconnected', async () => {
    mockDesktopStatus.mockResolvedValueOnce({ enabled: true, connected: false });
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 912 } },
      { type: 'done', data: { final_response: 'offline fallback' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    await chatAPI.sendMessageStream('Desktop offline test', { __mode: 'autonomous' }, null, () => {});

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.flags.server_fs).toBe(true);
    expect(body.flags.desktop_bridge_connected).toBe(false);
  });

  it('dispatches tool_request events to the electron bridge when enabled', async () => {
    const toolRequestEvent = {
      type: 'tool_request',
      request_id: 'req-desktop-1',
      run_id: 'run-desktop-1',
      step: 2,
      tool: 'fs.write',
      args: { path: '/tmp/weather.txt', contents: '72F and sunny' },
      requires_elevation: false,
      timeout_sec: 45,
    };
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 321 } },
      toolRequestEvent,
      { type: 'done', data: { final_response: 'complete' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    await chatAPI.sendMessageStream('Write todays weather', { __mode: 'autonomous' }, null, () => {});

    expect(mockExecuteRequest).toHaveBeenCalledTimes(1);
    expect(mockExecuteRequest).toHaveBeenCalledWith(expect.objectContaining({
      request_id: 'req-desktop-1',
      run_id: 'run-desktop-1',
      tool: 'fs.write',
      args: toolRequestEvent.args,
      requires_elevation: false,
      timeout_sec: 45,
    }));
  });

  it('does not dispatch desktop tool requests when the bridge reports offline', async () => {
    mockDesktopStatus.mockResolvedValueOnce({ enabled: true, connected: false });
    const sse = buildSSEStream([
      { type: 'ack', data: { id: 654 } },
      {
        type: 'tool_request',
        request_id: 'req-desktop-2',
        run_id: 'run-desktop-2',
        step: 3,
        tool: 'fs.write',
        args: { path: '/tmp/nofile.txt', contents: 'fail' },
      },
      { type: 'done', data: { final_response: 'server handled' } },
    ]);
    fetchSpy.mockResolvedValueOnce(sse);

    await chatAPI.sendMessageStream('Server handles tools', { __mode: 'autonomous' }, null, () => {});

    expect(mockExecuteRequest).not.toHaveBeenCalled();
  });

  it('recovers when the SSE reader throws mid-stream', async () => {
    const streamError = new TypeError('Failed to fetch: net::ERR_NETWORK_CHANGED');
    const failingStream = buildFailingSSEStream([
      { type: 'ack', data: { id: 1, stream_id: 'resume-stream-1' } },
      { type: 'plan', data: { steps: ['fetch', 'write'] } },
    ], 1, streamError);
    const recoveryStream = buildSSEStream([
      { type: 'ack', data: { id: 2, stream_id: 'resume-stream-1' } },
      { type: 'done', data: { final_response: 'Recovered after reader retry' } },
    ]);
    fetchSpy
      .mockResolvedValueOnce(failingStream)
      .mockResolvedValueOnce(recoveryStream);

    const events = [];
    await chatAPI.sendMessageStream('Recover mid stream', { __mode: 'autonomous' }, null, (evt) => events.push(evt));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondHeaders = fetchSpy.mock.calls[1][1].headers;
    expect(secondHeaders['X-Stream-Id']).toBe('resume-stream-1');
    const doneEvt = events.find((evt) => evt.type === 'done');
    expect(doneEvt?.data.final_response).toBe('Recovered after reader retry');
  });
});
