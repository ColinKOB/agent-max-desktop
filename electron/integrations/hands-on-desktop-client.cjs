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

const execAsync = promisify(exec);

class HandsOnDesktopClient {
    constructor(backendUrl, deviceToken, deviceSecret) {
        this.backendUrl = backendUrl;
        this.deviceToken = deviceToken;
        this.deviceSecret = deviceSecret;
        this.eventSource = null;
        this.reconnectDelay = 1000; // Start with 1s
        this.maxReconnectDelay = 30000; // Max 30s
        this.isConnected = false;
        this.onToolRequest = null; // Callback for tool requests
        this.onConnected = null;
        this.onDisconnected = null;
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
        }
    }

    resolveSafePath(rawPath) {
        if (!rawPath || typeof rawPath !== 'string') {
            throw new Error('Path is required for filesystem operations');
        }
        const homeDir = os.homedir();
        const expanded = rawPath.replace(/^~(?=$|\/|\\)/, homeDir);
        const resolved = path.resolve(expanded);
        const homeDirNormalized = path.resolve(homeDir);
        if (!resolved.startsWith(homeDirNormalized)) {
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

    /**
     * Generate HMAC signature for result
     */
    signResult(result) {
        // Create canonical payload (same as backend)
        const canonical = `${result.run_id}:${result.request_id}:${result.step}:${JSON.stringify(result)}`;
        
        // Generate HMAC-SHA256 signature
        const hmac = crypto.createHmac('sha256', this.deviceSecret);
        hmac.update(canonical);
        return hmac.digest('hex');
    }

    /**
     * Submit result to backend
     */
    async submitResult(result) {
        const signature = this.signResult(result);
        
        try {
            const response = await fetch(`${this.backendUrl}/api/v2/autonomous/tool-result`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.deviceToken}`,
                    'X-Run-Signature': signature,
                    'X-Request-ID': result.request_id,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result)
            });

            if (response.ok) {
                console.log('[HandsOnDesktop] Result submitted:', result.request_id);
            } else {
                const error = await response.text();
                console.error('[HandsOnDesktop] Failed to submit result:', response.status, error);
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
}

module.exports = { HandsOnDesktopClient };
