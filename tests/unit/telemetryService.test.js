import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const put = vi.fn().mockResolvedValue({ status: 200 });
  return {
    default: {
      put,
    },
    put,
  };
});

const flushMicrotasks = () => new Promise((resolve) => queueMicrotask(resolve));

describe('TelemetryService bridge routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    axios.put.mockClear();
  });

  afterEach(() => {
    delete global.window;
    delete global.navigator;
  });

  it('routes events through electron telemetry bridge when available', async () => {
    const record = vi.fn().mockResolvedValue({});
    const flush = vi.fn().mockResolvedValue({});
    const setEnabled = vi.fn().mockResolvedValue({ enabled: true });
    const bootstrap = {
      userId: 'desktop-user',
      sessionId: 'session-123',
      enabled: true,
      endpoint: 'https://telemetry.test',
      environment: { platform: 'darwin', appVersion: '1.0.0' },
      install: { totalLaunches: 1 },
    };

    global.window = {
      telemetry: {
        record,
        flush,
        setEnabled,
        getBootstrap: vi.fn().mockResolvedValue(bootstrap),
      },
      addEventListener: vi.fn(),
      navigator: {
        userAgent: 'test-agent',
        language: 'en-US',
        platform: 'MacIntel',
      },
      location: { href: 'app://index.html' },
      screen: { width: 1440, height: 900 },
      electron: { getAppVersion: () => '1.0.0' },
    };
    global.navigator = global.window.navigator;

    const module = await import('../../src/services/telemetry.js');
    const telemetry = module.default;

    await telemetry.bootstrapPromise;
    await flushMicrotasks();

    expect(record).toHaveBeenCalled(); // bootstrap handshake
    expect(telemetry.userId).toBe('desktop-user');
    expect(telemetry.sessionId).toBe('session-123');

    telemetry.logEvent('test-event', { foo: 'bar' });
    await flushMicrotasks();

    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[1][0]).toMatchObject({
      type: 'custom_event',
      eventName: 'test-event',
      properties: { foo: 'bar' },
    });

    await telemetry.flush();
    expect(flush).toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('falls back to direct HTTP batching when bridge unavailable', async () => {
    global.window = {
      addEventListener: vi.fn(),
      navigator: {
        userAgent: 'fallback-agent',
        language: 'en-US',
        platform: 'Win32',
      },
      location: { href: 'http://localhost' },
      screen: { width: 1920, height: 1080 },
    };
    global.navigator = global.window.navigator;

    const module = await import('../../src/services/telemetry.js');
    const telemetry = module.default;

    telemetry.setEnabled(true);
    telemetry.logEvent('http-event', { baz: 42 });
    await telemetry.flush();

    const axiosMod = await import('axios');
    expect(axiosMod.default.put).toHaveBeenCalledTimes(1);
    const [url, body] = axiosMod.default.put.mock.calls[0];
    expect(url).toContain('/api/telemetry/batch');
    expect(body.events[0]).toMatchObject({
      type: 'custom_event',
      eventName: 'http-event',
      properties: { baz: 42 },
    });

    if (telemetry.batchInterval) {
      clearInterval(telemetry.batchInterval);
      telemetry.batchInterval = null;
    }
  });
});
