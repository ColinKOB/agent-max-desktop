/**
 * Desktop Telemetry Broker
 * Aggregates renderer and main-process events and forwards them to the backend.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const log = require('electron-log');
const { machineIdSync } = require('node-machine-id');

// Generate RFC4122 v4 UUID without importing ESM-only 'uuid' package
function genUUID() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_) {}
  // Fallback generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_BATCH_SIZE = parseInt(process.env.TELEMETRY_BATCH_SIZE || '25', 10);
const DEFAULT_FLUSH_INTERVAL_MS = parseInt(process.env.TELEMETRY_FLUSH_INTERVAL_MS || '5000', 10);
const MAX_QUEUE_LENGTH = parseInt(process.env.TELEMETRY_MAX_QUEUE || '500', 10);
const STATE_FILENAME = 'telemetry-state.json';

class DesktopTelemetry {
  constructor() {
    this.app = null;
    this.ipcMain = null;
    this.initialized = false;
    this.sessionId = genUUID();
    this.endpoint = '';
    this.apiKey = '';
    this.queue = [];
    this.flushTimer = null;
    this.batchSize = DEFAULT_BATCH_SIZE;
    this.flushInterval = DEFAULT_FLUSH_INTERVAL_MS;
    this.enabled = true;
    this.bootstrap = null;
    this.installState = null;
    this.machineId = null;
    this.logHookAttached = false;
    this.consolePatched = false;
    this.originalConsole = {};
  }

  initialize({ app, ipcMain }) {
    if (this.initialized) {
      return this.bootstrap;
    }

    this.app = app;
    this.ipcMain = ipcMain;
    // Allow re-registration of IPC handlers when initialize is invoked in tests
    // or in rare cases where the main process is reloaded. In production, initialize
    // should run once, so this is a no-op for normal runs.
    this._ipcRegistered = false;

    this.endpoint =
      process.env.TELEMETRY_API ||
      process.env.TELEMETRY_ENDPOINT ||
      process.env.VITE_TELEMETRY_API ||
      // Fallback to general API URL if a dedicated telemetry endpoint isn't set
      process.env.VITE_API_URL ||
      '';
    this.apiKey =
      process.env.TELEMETRY_API_KEY ||
      process.env.VITE_TELEMETRY_API_KEY ||
      process.env.TELEMETRY_KEY ||
      process.env.API_KEY ||
      process.env.VITE_API_KEY ||
      '';

    this.batchSize = parseInt(process.env.TELEMETRY_BATCH_SIZE || this.batchSize, 10);
    this.flushInterval = parseInt(
      process.env.TELEMETRY_FLUSH_INTERVAL_MS || this.flushInterval,
      10
    );
    this.enabled = this.resolveEnablement();

    this.machineId = this.resolveMachineId();
    this.installState = this.loadInstallState();

    if (!this.installState.userId) {
      this.installState.userId = this.installState.installId;
      this.persistInstallState();
    }

    this.bootstrap = this.buildBootstrapPayload();
    this.initialized = true;

    this.attachLogHook();
    this.hookConsole();
    this.registerIPCHandlers();

    if (this.installState.isFirstRun) {
      this.captureEvent('app.lifecycle.install', {
        installId: this.installState.installId,
        firstRunAt: this.installState.firstRunAt,
        machineId: this.machineId,
        hardware: this.bootstrap.hardware,
      });
    }

    this.captureEvent('app.lifecycle.launch', {
      installId: this.installState.installId,
      firstRun: this.installState.isFirstRun,
      totalLaunches: this.installState.totalLaunches,
      sessionId: this.sessionId,
    });

    return this.bootstrap;
  }

  resolveEnablement() {
    if (process.env.TELEMETRY_DISABLED === 'true') {
      return false;
    }

    if (process.env.TELEMETRY_ENABLED === 'false') {
      return false;
    }

    return true;
  }

  resolveMachineId() {
    if (process.env.TELEMETRY_MACHINE_ID) {
      return process.env.TELEMETRY_MACHINE_ID;
    }

    try {
      return machineIdSync({ original: true });
    } catch (error) {
      log.warn('[Telemetry] Unable to read machine id:', error.message);
      return null;
    }
  }

  hashMachineId(value) {
    if (!value) return null;
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  loadInstallState() {
    const statePath = this.getStateFilePath();
    const payload = {
      installId: `amx-${genUUID()}`,
      userId: null,
      firstRunAt: new Date().toISOString(),
      lastRunAt: null,
      totalLaunches: 0,
      isFirstRun: false,
    };

    try {
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, 'utf8');
        const stored = JSON.parse(raw);
        payload.installId = stored.installId || payload.installId;
        payload.userId = stored.userId || stored.installId || payload.installId;
        payload.firstRunAt = stored.firstRunAt || payload.firstRunAt;
        payload.totalLaunches = stored.totalLaunches || 0;
        payload.lastRunAt = stored.lastRunAt || null;
      } else {
        payload.isFirstRun = true;
      }
    } catch (error) {
      log.error('[Telemetry] Failed to load state:', error);
      payload.isFirstRun = true;
    }

    const isFirstRun = payload.isFirstRun;
    payload.totalLaunches += 1;
    payload.lastRunAt = new Date().toISOString();
    this.writeStateToDisk({
      installId: payload.installId,
      userId: payload.userId,
      firstRunAt: payload.firstRunAt,
      lastRunAt: payload.lastRunAt,
      totalLaunches: payload.totalLaunches,
    });

    return { ...payload, isFirstRun };
  }

  getStateFilePath() {
    const telemetryDir = path.join(this.app.getPath('userData'), 'telemetry');
    if (!fs.existsSync(telemetryDir)) {
      try {
        fs.mkdirSync(telemetryDir, { recursive: true });
      } catch (error) {
        log.error('[Telemetry] Failed to create telemetry directory:', error);
      }
    }
    return path.join(telemetryDir, STATE_FILENAME);
  }

  writeStateToDisk(state) {
    try {
      fs.writeFileSync(this.getStateFilePath(), JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      log.error('[Telemetry] Failed to persist state:', error);
    }
  }

  persistInstallState() {
    if (this.installState) {
      this.writeStateToDisk(this.installState);
    }
  }

  buildBootstrapPayload() {
    return {
      enabled: this.enabled,
      endpoint: this.endpoint,
      apiKeyConfigured: Boolean(this.apiKey),
      userId: this.installState.userId,
      installId: this.installState.installId,
      sessionId: this.sessionId,
      machineIdHash: this.hashMachineId(this.machineId),
      hardware: this.collectHardwareSnapshot(),
      environment: {
        appVersion: this.app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        locale: this.app.getLocale ? this.app.getLocale() : undefined,
      },
      install: {
        firstRunAt: this.installState.firstRunAt,
        lastRunAt: this.installState.lastRunAt,
        totalLaunches: this.installState.totalLaunches,
        isFirstRun: this.installState.isFirstRun,
      },
    };
  }

  collectHardwareSnapshot() {
    const cpus = os.cpus() || [];
    const cpuSample = cpus[0] || {};
    let uptime = null;
    try {
      uptime = os.uptime();
    } catch (error) {
      uptime = null;
    }
    return {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      cpus: cpus.length,
      cpuModel: cpuSample.model,
      cpuSpeed: cpuSample.speed,
      machineId: this.machineId,
      uptime,
    };
  }

  attachLogHook() {
    if (this.logHookAttached) {
      return;
    }

    log.hooks.push((message) => {
      if (!this.enabled) {
        return message;
      }

      try {
        const formatted = this.formatLogArguments(message.data);

        this.enqueueEnvelope(
          this.createEnvelope('log.entry', {
            level: message.level,
            scope: Array.isArray(message.scope) ? message.scope.join('.') : message.scope,
            message: formatted,
            original: message.data,
          })
        );
      } catch (error) {
        // Ignore hook failures to prevent cascading errors
      }

      return message;
    });

    this.logHookAttached = true;
  }

  formatLogArguments(items = []) {
    return items
      .map((item) => {
        if (typeof item === 'string') return item;
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join(' ');
  }

  hookConsole() {
    if (this.consolePatched) {
      return;
    }

    const levels = ['log', 'info', 'warn', 'error'];
    levels.forEach((level) => {
      const original = console[level];
      this.originalConsole[level] = original;

      console[level] = (...args) => {
        try {
          const message = this.formatLogArguments(args);
          this.captureEvent('main.console', {
            level,
            message,
            args,
          }, { source: 'console' });
        } catch (error) {
          // Ignore telemetry failures to avoid impacting runtime logging
        }

        if (typeof original === 'function') {
          original.apply(console, args);
        }
      };
    });

    this.consolePatched = true;
  }

  registerIPCHandlers() {
    if (!this.ipcMain) return;

    // Avoid duplicate handler registration
    if (this._ipcRegistered) {
      return;
    }

    this.ipcMain.handle('telemetry:get-bootstrap', async () => {
      return this.bootstrap;
    });

    this.ipcMain.handle('telemetry:set-enabled', async (_event, enabled) => {
      this.enabled = Boolean(enabled);
      this.bootstrap.enabled = this.enabled;
      return { enabled: this.enabled };
    });

    this.ipcMain.handle('telemetry:flush', async () => this.flush());

    this.ipcMain.handle('telemetry:record', async (_event, payload) => {
      if (!this.enabled || !payload) {
        return { queued: false };
      }

      this.handleRendererPayload(payload);
      return { queued: true };
    });

    this._ipcRegistered = true;
  }

  handleRendererPayload(payload) {
    if (!payload) return;

    if (Array.isArray(payload)) {
      payload.forEach((item) => this.handleRendererPayload(item));
      return;
    }

    if (payload.eventType) {
      this.captureEvent(payload.eventType, payload.data || {}, { source: payload.source || 'renderer-legacy' });
      return;
    }

    if (payload.events && Array.isArray(payload.events)) {
      payload.events.forEach((evt) => this.handleRendererPayload(evt));
      return;
    }

    if (payload.type || payload.eventName) {
      this.enqueueEnvelope(this.normalizeRendererEvent(payload));
      return;
    }

    // Unknown payload shape: wrap as diagnostic blob
    this.captureEvent('renderer.telemetry.raw', { payload }, { source: 'renderer' });
  }

  normalizeRendererEvent(event) {
    const cloned = { ...event };
    const type = cloned.type || cloned.eventName || 'renderer.event';
    delete cloned.type;
    delete cloned.eventName;
    const rendererTimestamp = cloned.timestamp || cloned.createdAt;
    delete cloned.timestamp;
    delete cloned.createdAt;
    delete cloned.userId;
    delete cloned.sessionId;

    const envelope = this.createEnvelope(type, {
      ...cloned,
      bridge: 'renderer',
    }, {
      source: 'renderer',
    });

    if (rendererTimestamp) {
      envelope.timestamp = rendererTimestamp;
    }

    return envelope;
  }

  createEnvelope(type, payload = {}, meta = {}) {
    return {
      type,
      timestamp: new Date().toISOString(),
      userId: this.installState.userId,
      sessionId: this.sessionId,
      installId: this.installState.installId,
      machineIdHash: this.hashMachineId(this.machineId),
      environment: this.bootstrap.environment,
      hardware: this.bootstrap.hardware,
      meta: {
        ...meta,
      },
      payload,
    };
  }

  enqueueEnvelope(envelope) {
    if (!envelope) return;
    this.queue.push(envelope);

    if (this.queue.length > MAX_QUEUE_LENGTH) {
      this.queue = this.queue.slice(-MAX_QUEUE_LENGTH);
    }

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.ensureFlushTimer();
    }
  }

  captureEvent(type, payload = {}, meta = {}) {
    this.enqueueEnvelope(this.createEnvelope(type, payload, meta));
  }

  ensureFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushInterval);

    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  async flush() {
    if (!this.enabled || this.queue.length === 0) {
      return { sent: 0 };
    }

    if (!this.endpoint) {
      return { sent: 0, error: 'TELEMETRY_ENDPOINT_NOT_CONFIGURED' };
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const events = [...this.queue];
    this.queue = [];

    const base = (this.endpoint || '').replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
    const timeout = parseInt(process.env.TELEMETRY_TIMEOUT_MS || '6000', 10);

    const sendOnce = async (url, body) => {
      try {
        const res = await axios.put(url, body, {
          headers,
          timeout,
          validateStatus: () => true,
        });
        return res;
      } catch (err) {
        return { status: 0, data: { error: err.message } };
      }
    };

    // 1) Try legacy prefix first (existing behavior)
    let url = `${base}/api/telemetry/batch`;
    let res = await sendOnce(url, { events });

    // If the server complains about missing "value", retry with legacy wrapper
    const bodyText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
    const needsLegacy = res.status === 422 && /value/i.test(bodyText);
    if (needsLegacy) {
      res = await sendOnce(url, { value: { events } });
    }

    // If 404/405 or still failing, try the v2 prefix
    if ((res.status === 404 || res.status === 405 || res.status === 0) || (res.status >= 400 && res.status < 600)) {
      url = `${base}/api/v2/telemetry/batch`;
      res = await sendOnce(url, { events });
      const bodyText2 = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
      const needsLegacy2 = res.status === 422 && /value/i.test(bodyText2);
      if (needsLegacy2) {
        res = await sendOnce(url, { value: { events } });
      }
    }

    if (res.status >= 200 && res.status < 300) {
      return { sent: events.length };
    }

    log.warn('[Telemetry] Failed to send batch:', res.status, res.data);
    // Return events to queue for retry
    this.queue = [...events, ...this.queue];
    if (this.queue.length > MAX_QUEUE_LENGTH) {
      this.queue = this.queue.slice(-MAX_QUEUE_LENGTH);
    }
    return { sent: 0, error: res.data };
  }
}

const telemetry = new DesktopTelemetry();

module.exports = telemetry;
