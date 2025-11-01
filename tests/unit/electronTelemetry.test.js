import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron-log', () => {
  const hooks = [];
  return {
    hooks,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

vi.mock('node-machine-id', () => ({
  machineIdSync: vi.fn(() => 'machine-test'),
}));

vi.mock('axios', () => ({
  post: vi.fn().mockResolvedValue({ status: 200 }),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

describe('electron telemetry broker', () => {
  let tmpDir;
  let telemetry;
  let ipcHandlers;
  let app;

  beforeEach(async () => {
    vi.resetModules();
    const uuidModule = await import('uuid');
    const uuidValues = ['session-abc', 'install-def', 'extra-ghi'];
    uuidModule.v4.mockImplementation(() => uuidValues.shift() || 'uuid-fallback');

    const logModule = await import('electron-log');
    logModule.hooks.length = 0;

    const axiosModule = await import('axios');
    axiosModule.post.mockClear();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amx-telemetry-'));
    process.env.TELEMETRY_API = 'https://telemetry.test';
    process.env.TELEMETRY_API_KEY = 'test-key';
    process.env.TELEMETRY_MACHINE_ID = 'machine-test';

    ipcHandlers = {};
    app = {
      getPath: vi.fn(() => tmpDir),
      getVersion: vi.fn(() => '2.0.0'),
      getLocale: vi.fn(() => 'en-US'),
    };

    const ipcMain = {
      handle: vi.fn((channel, handler) => {
        ipcHandlers[channel] = handler;
      }),
    };

    const module = await import('../../electron/telemetry.cjs');
    telemetry = module.default || module;
    telemetry.initialized = false;
    telemetry.queue = [];

    telemetry.initialize({ app, ipcMain });
  });

  afterEach(() => {
    if (telemetry && telemetry.originalConsole) {
      ['log', 'info', 'warn', 'error'].forEach((level) => {
        if (telemetry.originalConsole[level]) {
          console[level] = telemetry.originalConsole[level];
        }
      });
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    delete process.env.TELEMETRY_API;
    delete process.env.TELEMETRY_API_KEY;
    delete process.env.TELEMETRY_MACHINE_ID;
  });

  it('initializes and records lifecycle events with machine metadata', () => {
    expect(ipcHandlers['telemetry:record']).toBeInstanceOf(Function);
    expect(ipcHandlers['telemetry:get-bootstrap']).toBeInstanceOf(Function);

    const eventTypes = telemetry.queue.map((evt) => evt.type);
    expect(eventTypes).toContain('app.lifecycle.install');
    expect(eventTypes).toContain('app.lifecycle.launch');

    expect(telemetry.machineId).toBe('machine-test');
    expect(telemetry.bootstrap.machineIdHash).toBe(
      telemetry.hashMachineId(telemetry.machineId)
    );
    expect(telemetry.bootstrap.userId).toMatch(/^amx-/);
    expect(telemetry.bootstrap.environment.appVersion).toBe('2.0.0');
    expect(telemetry.bootstrap.hardware.machineId).toBe('machine-test');
  });

  it('normalizes renderer payloads sent through IPC', async () => {
    const recordHandler = ipcHandlers['telemetry:record'];

    await recordHandler({}, { type: 'custom_event', foo: 'bar', timestamp: '2024-01-01T00:00:00Z' });
    const latest = telemetry.queue.at(-1);
    expect(latest.type).toBe('custom_event');
    expect(latest.timestamp).toBe('2024-01-01T00:00:00Z');
    expect(latest.payload).toMatchObject({ foo: 'bar', bridge: 'renderer' });
    expect(latest.meta.source).toBe('renderer');
    expect(latest.userId).toBe(telemetry.installState.userId);

    await recordHandler({}, { eventType: 'legacy.event', data: { value: 7 } });
    const legacy = telemetry.queue.at(-1);
    expect(legacy.type).toBe('legacy.event');
    expect(legacy.payload).toMatchObject({ value: 7 });
    expect(legacy.meta.source).toBe('renderer-legacy');
  });
});
