/**
 * Autonomous WebSocket Service
 * 
 * Handles WebSocket communication with the backend for autonomous execution.
 * Implements the monetization architecture protocol.
 * 
 * Protocol Flow:
 * 1. Client connects
 * 2. Client sends INIT with goal
 * 3. Server sends ACTION messages
 * 4. Client executes and sends RESULT
 * 5. Repeat until FINISH
 */

class AutonomousWebSocket {
  constructor(apiUrl = 'http://localhost:8000') {
    this.apiUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isReconnecting = false;
    this.lastAcknowledgedStepId = null;
    this.conversationId = null;
    this.goal = null;
    this.capabilities = null;
    this.listeners = {
      action: [],
      finish: [],
      error: [],
      connected: [],
      disconnected: [],
      reconnecting: [],
      reconnected: [],
      'reconnect-failed': []
    };
  }

  /**
   * Connect to WebSocket endpoint
   */
  async connect(url, options = {}) {
    this.url = url;
    
    // Store connection options for reconnection
    if (options.goal) this.goal = options.goal;
    if (options.capabilities) this.capabilities = options.capabilities;
    if (options.conversationId) this.conversationId = options.conversationId;
    
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.apiUrl}/api/v2/autonomous/ws/execute`;
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          if (this.isReconnecting) {
            console.log('[WebSocket] Reconnected successfully');
            this.isReconnecting = false;
            this._emit('reconnected');
          } else {
            this._emit('connected');
          }
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
            this._emit('error', { code: 'PARSE_ERROR', message: error.message });
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this._emit('error', { code: 'CONNECTION_ERROR', message: error.message });
          reject(error);
        };
        
        this.ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected', event.code, event.reason);
          this.connected = false;
          this._emit('disconnected');
          
          // Don't reconnect if it was a clean close (1000)
          if (event.code === 1000 && event.wasClean) {
            console.log('[WebSocket] Clean disconnect, not reconnecting');
            return;
          }
          
          // Attempt reconnection if not intentionally closed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this._reconnect();
          } else {
            this._emit('reconnect-failed');
          }
        };
      } catch (error) {
        console.error('[WebSocket] Failed to create connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Send INIT message to start conversation
   */
  async startConversation(goal, capabilities = {}) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }
    
    const initMessage = {
      type: 'INIT',
      goal,
      capabilities: {
        browser: true,
        screenshot: true,
        ...capabilities
      }
    };
    
    console.log('[WebSocket] Sending INIT:', goal);
    this.send(initMessage);
  }

  /**
   * Send RESULT message after action execution
   */
  async sendResult(stepId, success, result) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }
    
    const resultMessage = {
      type: 'RESULT',
      step_id: stepId,
      success,
      result
    };
    
    console.log('[WebSocket] Sending RESULT:', stepId, success ? '✅' : '❌');
    this.send(resultMessage);
  }

  /**
   * Send generic message
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not ready');
    }
    
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Close connection
   */
  close() {
    console.log('[WebSocket] Closing connection');
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
    }
  }

  disconnect() {
    // Cancel any pending reconnection
    this.isReconnecting = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect'); // Clean close
      this.ws = null;
    }
  }

  /**
   * Track acknowledged step (called after successfully processing result)
   */
  acknowledgeStep(stepId, conversationId) {
    this.lastAcknowledgedStepId = stepId;
    if (conversationId) {
      this.conversationId = conversationId;
    }
    console.log(`[AutonomousWS] Acknowledged step: ${stepId}`);
  }

  /**
   * Clear conversation state (on FINISH or error)
   */
  clearConversationState() {
    this.lastAcknowledgedStepId = null;
    this.conversationId = null;
    this.goal = null;
    console.log('[AutonomousWS] Conversation state cleared');
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Handle incoming message
   */
  _handleMessage(message) {
    const { type } = message;
    
    console.log('[WebSocket] Received:', type);
    
    switch (type) {
      case 'ACTION':
        this._emit('action', {
          stepId: message.step_id,
          seq: message.seq,
          action: message.action,
          policy: message.policy
        });
        break;
      
      case 'FINISH':
        this._emit('finish', {
          success: message.success,
          summary: message.summary
        });
        break;
      
      case 'ERROR':
        console.error('[WebSocket] Server error:', message.code, message.message);
        this._emit('error', {
          code: message.code,
          message: message.message
        });
        break;
      
      default:
        console.warn('[WebSocket] Unknown message type:', type);
    }
  }

  /**
   * Emit event to all listeners
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Attempt to reconnect
   */
  _reconnect() {
    this.reconnectAttempts++;
    this.isReconnecting = true;
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(
      `[WebSocket] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );
    
    this._emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(() => {
      if (this.isReconnecting) {
        this.connect().then(() => {
          this.isReconnecting = false;
          this._emit('reconnected');
        }).catch(error => {
          console.error('[WebSocket] Reconnection failed:', error);
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this._emit('reconnect-failed');
          }
        });
      }
    }, delay);
  }
}

export default AutonomousWebSocket;
