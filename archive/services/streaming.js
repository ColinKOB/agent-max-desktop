/**
 * Streaming service for Server-Sent Events (SSE)
 * Handles real-time thoughts, progress, and command previews
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class StreamingService {
  constructor() {
    this.eventSource = null;
    this.listeners = {
      thought: [],
      progress: [],
      command: [],
      error: [],
    };
  }

  /**
   * Start streaming for a conversation
   * @param {string} message - User message to send
   * @param {Object} options - Additional options
   */
  startStream(message, options = {}) {
    // Close existing connection if any
    this.stopStream();

    // Example: Connect to your streaming endpoint
    // Adjust the URL to match your backend's streaming endpoint
    const url = new URL(`${API_BASE}/v1/chat/stream`);
    url.searchParams.append('message', message);
    
    if (options.userId) {
      url.searchParams.append('user_id', options.userId);
    }

    this.eventSource = new EventSource(url.toString());

    // Thought events - intermediate processing steps
    this.eventSource.addEventListener('thought', (event) => {
      const thought = event.data;
      this.emit('thought', thought);
    });

    // Progress events - completion percentage (0-100)
    this.eventSource.addEventListener('progress', (event) => {
      const progress = Number(event.data);
      this.emit('progress', progress);
    });

    // Command events - executable command preview
    this.eventSource.addEventListener('command', (event) => {
      try {
        const command = JSON.parse(event.data);
        this.emit('command', command);
      } catch (error) {
        console.error('Failed to parse command:', error);
      }
    });

    // Final event - conversation complete
    this.eventSource.addEventListener('final', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.command) {
          this.emit('command', data.command);
        }
        this.stopStream();
      } catch (error) {
        console.error('Failed to parse final event:', error);
      }
    });

    // Error handling
    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      this.emit('error', error);
      this.stopStream();
    };
  }

  /**
   * Stop the current stream
   */
  stopStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Register an event listener
   * @param {string} event - Event type (thought, progress, command, error)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Unregister an event listener
   * @param {string} event - Event type
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event to all listeners
   * @param {string} event - Event type
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Clear all listeners
   */
  clearListeners() {
    this.listeners = {
      thought: [],
      progress: [],
      command: [],
      error: [],
    };
  }
}

// Singleton instance
export const streamingService = new StreamingService();

export default streamingService;
