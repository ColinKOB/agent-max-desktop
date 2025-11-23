/**
 * Network Monitor - Detects online/offline status
 * 
 * Monitors network connectivity and notifies listeners of status changes.
 * Used by executor to enable offline execution and background sync.
 */

const { net } = require('electron');
const EventEmitter = require('events');

class NetworkMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.isOnline = true;
        this.checkIntervalMs = config.checkIntervalMs || 10000; // 10 seconds
        this.checkUrl = config.checkUrl || 'https://agentmax-production.up.railway.app/health';
        this.checkTimer = null;
        this.lastCheckTime = null;
        this.consecutiveFailures = 0;
        this.maxFailuresBeforeOffline = 2; // Consider offline after 2 failures
        
        console.log('[NetworkMonitor] Initialized');
    }

    /**
     * Start monitoring network status
     */
    start() {
        if (this.checkTimer) {
            console.log('[NetworkMonitor] Already running');
            return;
        }

        console.log('[NetworkMonitor] Starting network monitoring');
        
        // Initial check
        this.checkConnectivity();
        
        // Periodic checks
        this.checkTimer = setInterval(() => {
            this.checkConnectivity();
        }, this.checkIntervalMs);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            console.log('[NetworkMonitor] Stopped network monitoring');
        }
    }

    /**
     * Check network connectivity
     */
    async checkConnectivity() {
        this.lastCheckTime = Date.now();
        
        try {
            // Try to reach the backend health endpoint
            const online = await this.pingBackend();
            
            if (online) {
                this.consecutiveFailures = 0;
                this.setOnlineStatus(true);
            } else {
                this.consecutiveFailures++;
                
                if (this.consecutiveFailures >= this.maxFailuresBeforeOffline) {
                    this.setOnlineStatus(false);
                }
            }
        } catch (error) {
            console.error('[NetworkMonitor] Check error:', error.message);
            this.consecutiveFailures++;
            
            if (this.consecutiveFailures >= this.maxFailuresBeforeOffline) {
                this.setOnlineStatus(false);
            }
        }
    }

    /**
     * Ping backend to check connectivity
     */
    async pingBackend() {
        return new Promise((resolve) => {
            const request = net.request({
                method: 'GET',
                url: this.checkUrl,
                timeout: 5000 // 5 second timeout
            });

            let responded = false;

            request.on('response', (response) => {
                responded = true;
                // Any response (even error) means we're online
                resolve(response.statusCode >= 200 && response.statusCode < 500);
            });

            request.on('error', (error) => {
                if (!responded) {
                    console.log('[NetworkMonitor] Ping failed:', error.message);
                    resolve(false);
                }
            });

            request.on('timeout', () => {
                if (!responded) {
                    console.log('[NetworkMonitor] Ping timeout');
                    request.abort();
                    resolve(false);
                }
            });

            request.end();
        });
    }

    /**
     * Set online status and emit events if changed
     */
    setOnlineStatus(online) {
        if (this.isOnline !== online) {
            const previousStatus = this.isOnline;
            this.isOnline = online;
            
            console.log(`[NetworkMonitor] Status changed: ${previousStatus ? 'online' : 'offline'} → ${online ? 'online' : 'offline'}`);
            
            // Emit status change event
            this.emit('status-changed', {
                isOnline: online,
                wasOnline: previousStatus,
                timestamp: Date.now()
            });
            
            // Emit specific events
            if (online) {
                this.emit('online');
            } else {
                this.emit('offline');
            }
        }
    }

    /**
     * Get current online status
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            lastCheckTime: this.lastCheckTime,
            consecutiveFailures: this.consecutiveFailures
        };
    }

    /**
     * Force a connectivity check
     */
    async forceCheck() {
        console.log('[NetworkMonitor] Forcing connectivity check');
        await this.checkConnectivity();
        return this.isOnline;
    }
}

module.exports = { NetworkMonitor };
