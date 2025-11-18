/**
 * Hands on Desktop Client - SSE Client for Tool Requests
 * 
 * Listens for tool_request events from backend and executes them locally.
 * Part of the "Hands on Desktop" migration (Phase 1).
 */

const EventSource = require('eventsource');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

let electronApp = null;
try {
    electronApp = require('electron').app;
} catch (err) {
    electronApp = null;
}

const PLACEHOLDER_HOME_PREFIXES = [
    '/home/user',
    '\\home\\user',
    '/Users/user',
    '\\Users\\user',
    'C:\\Users\\user',
    'C:/Users/user',
];

const TEMP_PATH_PREFIXES = (() => {
    const set = new Set();
    const tmp = os.tmpdir ? os.tmpdir() : '/tmp';
    if (tmp) set.add(path.resolve(tmp));
    set.add('/tmp');
    set.add('\\tmp');
    return Array.from(set).filter(Boolean);
})();

function getPreferredHomeDir() {
    const fallback = os.homedir();
    if (electronApp && typeof electronApp.getPath === 'function') {
        try {
            return electronApp.getPath('home') || fallback;
        } catch (err) {
            // If called before ready, fall back to OS value
        }
    }
    if (process.env.HOME && process.env.HOME.length > 1) {
        return process.env.HOME;
    }
    if (process.env.USERPROFILE && process.env.USERPROFILE.length > 1) {
        return process.env.USERPROFILE;
    }
    return fallback;
}

const execAsync = promisify(exec);

class HandsOnDesktopClient {
    constructor(backendUrl, credentials, pairing, userId = 'desktop_user') {
        this.backendUrl = backendUrl;
        this.deviceToken = credentials?.device_token;
        this.deviceSecret = credentials?.device_secret;
        this.deviceId = credentials?.device_id || null;
        this.pairing = pairing || null;
        this.pairedUserId = userId;
        this.eventSource = null;
        this.reconnectDelay = 1000; // Start with 1s
        this.maxReconnectDelay = 30000; // Max 30s
        this.isConnected = false;
        this.onToolRequest = null; // Callback for tool requests
        this.onConnected = null;
        this.onDisconnected = null;
        this.executingRequests = new Set();
        this.pollInFlight = false;
        this.pollTimer = null;
        this.pollIntervalMs = parseInt(process.env.HANDS_ON_DESKTOP_POLL_INTERVAL_MS || '2000', 10);
        this.pollBatchSize = parseInt(process.env.HANDS_ON_DESKTOP_POLL_BATCH || '3', 10);
        this.startPolling();
    }

    /**
     * Connect to backend SSE endpoint
     */
    connect() {
        if (this.eventSource) {
            this.disconnect();
        }

        if (process.env.HANDS_ON_DESKTOP_DEVICE_STREAM === '0') {
            console.log('[HandsOnDesktop] Device stream disabled via env flag');
            return;
        }

        const url = `${this.backendUrl}/api/v2/autonomous/stream?device_token=${this.deviceToken}`;
        
        console.log('[HandsOnDesktop] Connecting to:', url);
        
        this.eventSource = new EventSource(url);
        
        this.eventSource.addEventListener('open', () => {
            console.log('[HandsOnDesktop] Connected to backend');
            this.isConnected = true;
            this.reconnectDelay = 1000; // Reset delay on successful connection
            if (this.onConnected) {
                this.onConnected();
            }
        });

        this.eventSource.addEventListener('tool_request', (event) => {
            try {
                const request = JSON.parse(event.data);
                console.log('[HandsOnDesktop] Received tool_request:', request.request_id);
                this.handleToolRequest(request);
            } catch (error) {
                console.error('[HandsOnDesktop] Failed to parse tool_request:', error);
            }
        });

        this.eventSource.addEventListener('error', (error) => {
            console.error('[HandsOnDesktop] SSE error:', error);
            this.isConnected = false;
            
            if (this.onDisconnected) {
                this.onDisconnected(error);
            }
            
            // Reconnect with exponential backoff
            this.scheduleReconnect();
        });
    }

    /**
     * Disconnect from backend
     */
    disconnect() {
        if (this.eventSource) {
            console.log('[HandsOnDesktop] Disconnecting...');
            this.eventSource.close();
        this.eventSource = null;
        this.isConnected = false;
        this.stopPolling();
    }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        console.log(`[HandsOnDesktop] Reconnecting in ${this.reconnectDelay}ms...`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
        
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }

    /**
     * Handle incoming tool request
     */
    async handleToolRequest(request) {
        const { request_id, run_id, step, tool, command, requires_elevation, timeout_sec } = request;
        if (!request_id) {
            console.warn('[HandsOnDesktop] Missing request_id in tool request');
            return;
        }
        if (this.executingRequests.has(request_id)) {
            console.log('[HandsOnDesktop] Request already in progress, skipping:', request_id);
            return;
        }
        this.executingRequests.add(request_id);
        const preview = command ? `${command.substring(0, 50)}...` : null;
        console.log('[HandsOnDesktop] Executing:', {
            request_id,
            tool,
            command: preview,
            requires_elevation
        });

        try {
            let result;
            
            if (tool === 'shell') {
                result = await this.executeShellCommand(command, requires_elevation, timeout_sec);
            } else if (tool === 'fs.write') {
                result = await this.executeWriteFile(request.args || {});
            } else if (tool === 'fs.mkdir') {
                result = await this.executeMkdir(request.args || {});
            } else {
                result = {
                    success: false,
                    exit_code: 1,
                    stdout: '',
                    stderr: `Unsupported tool: ${tool}`,
                    duration_ms: 0
                };
            }

            // Submit result to backend
            await this.submitResult({
                request_id,
                run_id,
                step,
                tool,
                ...result,
                metadata: { timestamp: new Date().toISOString() }
            });

        } catch (error) {
            console.error('[HandsOnDesktop] Execution failed:', error);
            
            // Submit error result
            await this.submitResult({
                request_id,
                run_id,
                step,
                tool,
                success: false,
                exit_code: 1,
                stdout: '',
                stderr: error.message,
                duration_ms: 0,
                metadata: { timestamp: new Date().toISOString() }
            });
        } finally {
            this.executingRequests.delete(request_id);
        }
    }

    resolveSafePath(rawPath) {
        if (!rawPath || typeof rawPath !== 'string') {
            throw new Error('Path is required for filesystem operations');
        }
        const homeDir = getPreferredHomeDir();
        const normalizedHome = path.resolve(homeDir);
        const safeRoot = normalizedHome.endsWith(path.sep) ? normalizedHome : `${normalizedHome}${path.sep}`;

        let candidate = rawPath.trim();
        // Expand tilde prefix
        candidate = candidate.replace(/^~(?=$|[\/\\])/, normalizedHome);

        // Replace backend placeholder home directories with the real one
        for (const prefix of PLACEHOLDER_HOME_PREFIXES) {
            if (candidate.startsWith(prefix)) {
                const remainder = candidate.slice(prefix.length).replace(/^[/\\]+/, '');
                candidate = path.join(normalizedHome, remainder);
                break;
            }
        }

        // Treat bare relative paths as relative to the user's home
        if (!path.isAbsolute(candidate)) {
            candidate = path.join(normalizedHome, candidate);
        }

        // Remap temp paths (e.g., /tmp) into user's Desktop for macOS sandbox compliance
        const desktopDir = path.join(normalizedHome, 'Desktop');
        for (const tmpPrefix of TEMP_PATH_PREFIXES) {
            const resolvedTmp = path.resolve(tmpPrefix);
            if (candidate.startsWith(resolvedTmp)) {
                const remainder = candidate.slice(resolvedTmp.length).replace(/^[/\\]+/, '');
                candidate = path.join(desktopDir, remainder || `tmp_${Date.now()}`);
                break;
            }
        }

        const resolved = path.resolve(candidate);
        if (!(resolved === normalizedHome || resolved.startsWith(safeRoot))) {
            throw new Error(`Access denied: Path must be within home directory. Attempted: ${resolved}`);
        }
        return resolved;
    }

    async executeWriteFile(args) {
        const start = Date.now();
        const resolvedPath = this.resolveSafePath(args.path);
        const content = typeof args.content === 'string' ? args.content : '';
        await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.promises.writeFile(resolvedPath, content, 'utf8');
        return {
            success: true,
            exit_code: 0,
            stdout: `Wrote ${resolvedPath}`,
            stderr: '',
            duration_ms: Date.now() - start
        };
    }

    async executeMkdir(args) {
        const start = Date.now();
        const resolvedPath = this.resolveSafePath(args.path);
        await fs.promises.mkdir(resolvedPath, { recursive: true });
        return {
            success: true,
            exit_code: 0,
            stdout: `Directory ready at ${resolvedPath}`,
            stderr: '',
            duration_ms: Date.now() - start
        };
    }

    /**
     * Execute shell command
     */
    async executeShellCommand(command, requiresElevation, timeoutSec) {
        const startTime = Date.now();
        
        try {
            let fullCommand = command;
            
            // If requires elevation, request password via IPC
            if (requiresElevation && command.startsWith('sudo ')) {
                console.log('[HandsOnDesktop] Requesting sudo password from user...');
                
                // Remove 'sudo ' prefix for display
                const commandWithoutSudo = command.replace(/^sudo\s+/, '');
                
                // Request password via IPC (this will show the modal in the renderer)
                const password = await this.requestSudoPassword(commandWithoutSudo, timeoutSec);
                
                if (!password) {
                    return {
                        success: false,
                        exit_code: 1,
                        stdout: '',
                        stderr: 'Sudo approval denied or timed out',
                        duration_ms: Date.now() - startTime
                    };
                }
                
                // Execute with password via stdin
                fullCommand = `echo "${password}" | sudo -S ${commandWithoutSudo}`;
                
                // Clear password from memory
                // (JavaScript doesn't have secure memory clearing, but we do our best)
                password.replace(/./g, '0');
            }

            const { stdout, stderr } = await execAsync(fullCommand, {
                timeout: (timeoutSec || 60) * 1000,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

            return {
                success: true,
                exit_code: 0,
                stdout: stdout || '',
                stderr: stderr || '',
                duration_ms: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                exit_code: error.code || 1,
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Request sudo password from user via IPC
     * Shows modal in renderer process
     */
    async requestSudoPassword(command, timeoutSec) {
        // This will be called from the main process
        // We need to use IPC to communicate with the renderer
        
        // For now, return null (password modal will be wired up via IPC handlers)
        // The actual implementation will be in the IPC handler
        console.log('[HandsOnDesktop] Sudo modal not yet wired to IPC');
        return null;
    }

    async refreshCredentials(reason = 'refresh') {
        if (!this.pairing) {
            console.warn('[HandsOnDesktop] Cannot refresh credentials; no pairing helper available');
            return false;
        }
        try {
            console.warn('[HandsOnDesktop] Refreshing device credentials due to', reason);
            const newCreds = await this.pairing.pairWithBackend(this.pairedUserId || 'desktop_user');
            await this.pairing.saveCredentials(newCreds);
            this.deviceToken = newCreds.device_token;
            this.deviceSecret = newCreds.device_secret;
            this.deviceId = newCreds.device_id;
            return true;
        } catch (error) {
            console.error('[HandsOnDesktop] Failed to refresh credentials:', error);
            return false;
        }
    }

    /**
     * Generate HMAC signature for result
     */
    signResult(result) {
        const canonicalJson = (value) => {
            if (value === null || value === undefined) return 'null';
            const type = typeof value;
            if (type === 'number' || type === 'boolean') {
                return JSON.stringify(value);
            }
            if (type === 'string') {
                return JSON.stringify(value);
            }
            if (Array.isArray(value)) {
                return '[' + value.map(item => canonicalJson(item)).join(',') + ']';
            }
            if (type === 'object') {
                const keys = Object.keys(value).sort();
                const parts = keys.map(key => {
                    const val = value[key];
                    return JSON.stringify(key) + ':' + canonicalJson(val);
                });
                return '{' + parts.join(',') + '}';
            }
            return 'null';
        };
        // Create canonical payload (matches backend sort_keys=True, separators=(',', ':'))
        const canonical = `${result.run_id}:${result.request_id}:${result.step}:${canonicalJson(result)}`;
        
        // Generate HMAC-SHA256 signature
        const hmac = crypto.createHmac('sha256', this.deviceSecret);
        hmac.update(canonical);
        return hmac.digest('hex');
    }

    /**
     * Ensure result payload matches backend schema + canonicalization rules
     */
    normalizeResultPayload(result) {
        const toNumber = (value, fallback = 0) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value;
            }
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toStringSafe = (value, fallback = '') => {
            if (value === null || value === undefined) return fallback;
            if (typeof value === 'string') return value;
            if (typeof value === 'object' && typeof value.toString === 'function') {
                try {
                    const str = value.toString();
                    if (typeof str === 'string') {
                        return str;
                    }
                } catch (_) { /* ignore */ }
            }
            return String(value);
        };

        const normalized = {
            run_id: toStringSafe(result.run_id),
            request_id: toStringSafe(result.request_id),
            step: toNumber(result.step),
            tool: toStringSafe(result.tool),
            success: Boolean(result.success),
            exit_code: toNumber(result.exit_code, 0),
            stdout: toStringSafe(result.stdout, ''),
            stderr: toStringSafe(result.stderr, ''),
            duration_ms: toNumber(result.duration_ms, 0)
        };

        if (result.error !== undefined) {
            normalized.error = toStringSafe(result.error);
        }
        if (result.error_code !== undefined && result.error_code !== null) {
            normalized.error_code = toStringSafe(result.error_code);
        }

        const metadata = (typeof result.metadata === 'object' && result.metadata !== null)
            ? { ...result.metadata }
            : {};
        if (!metadata.timestamp) {
            metadata.timestamp = new Date().toISOString();
        }
        normalized.metadata = metadata;

        return normalized;
    }

    /**
     * Submit result to backend
     */
    async submitResult(result, attempt = 0) {
        const payload = this.normalizeResultPayload(result);
        const performSubmit = async () => {
            const signature = this.signResult(payload);
            return fetch(`${this.backendUrl}/api/v2/autonomous/tool-result`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.deviceToken}`,
                    'X-Run-Signature': signature,
                    'X-Request-ID': payload.request_id,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        };

        try {
            const response = await performSubmit();

            if (response.ok) {
                console.log('[HandsOnDesktop] Result submitted:', result.request_id);
                return;
            }

            const error = await response.text();
            console.error('[HandsOnDesktop] Failed to submit result:', response.status, error);

            if (response.status === 401 && attempt === 0) {
                const refreshed = await this.refreshCredentials('auth_failed');
                if (refreshed) {
                    return this.submitResult(result, attempt + 1);
                }
            }

        } catch (error) {
            console.error('[HandsOnDesktop] Network error submitting result:', error);
            // TODO: Implement retry logic with exponential backoff
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            backendUrl: this.backendUrl,
            reconnectDelay: this.reconnectDelay
        };
    }

    startPolling() {
        if (this.pollTimer || !this.backendUrl || !this.deviceToken) {
            return;
        }
        this.pollTimer = setInterval(() => {
            this.pollPendingRequests().catch((err) => {
                console.error('[HandsOnDesktop] Polling error:', err);
            });
        }, this.pollIntervalMs);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    async pollPendingRequests() {
        if (this.pollInFlight || !this.deviceToken) {
            return;
        }
        this.pollInFlight = true;
        try {
            const url = `${this.backendUrl}/api/v2/autonomous/device/pending?limit=${this.pollBatchSize}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.deviceToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 401) {
                await this.refreshCredentials('pending_auth_failed');
                return;
            }
            if (!response.ok) {
                console.warn('[HandsOnDesktop] Pending request poll failed:', response.status);
                return;
            }
            const data = await response.json().catch(() => null);
            const pending = (data && data.pending_requests) || [];
            for (const req of pending) {
                this.dispatchPendingRequest(req);
            }
        } catch (error) {
            console.error('[HandsOnDesktop] Pending request poll error:', error);
        } finally {
            this.pollInFlight = false;
        }
    }

    dispatchPendingRequest(pending) {
        if (!pending || !pending.request_id) {
            return;
        }
        if (this.executingRequests.has(pending.request_id)) {
            return;
        }
        const normalized = {
            request_id: pending.request_id,
            run_id: pending.run_id,
            step: pending.step ?? 0,
            tool: pending.tool,
            command: pending.command || (pending.args && pending.args.command) || null,
            args: pending.args || {},
            requires_elevation: !!pending.requires_elevation,
            timeout_sec: pending.timeout_sec || 60
        };
        this.handleToolRequest(normalized).catch((err) => {
            console.error('[HandsOnDesktop] Failed to handle polled request:', err);
        });
    }
}

module.exports = { HandsOnDesktopClient };
