/**
 * Request Queue for handling offline scenarios
 * Queues requests when offline and processes them when back online
 */

class RequestQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxQueueSize = 10;
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Function that returns a promise
   * @param {Object} metadata - Metadata about the request
   * @returns {Promise} - Resolves when request completes or is queued
   */
  async add(requestFn, metadata = {}) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Request queue is full. Please wait.');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        metadata,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      try {
        console.log(`[Queue] Processing request: ${item.metadata.type || 'unknown'}`);
        const result = await item.requestFn();
        item.resolve(result);
        this.queue.shift(); // Remove from queue after success
      } catch (error) {
        // If network error, keep in queue and stop processing
        if (!error.response) {
          console.log('[Queue] Network error, keeping request in queue');
          break;
        }

        // For other errors, reject and remove from queue
        item.reject(error);
        this.queue.shift();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Clear all queued requests
   */
  clear() {
    this.queue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Get queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Get queued requests metadata
   */
  getQueuedRequests() {
    return this.queue.map((item) => ({
      type: item.metadata.type,
      timestamp: item.metadata.timestamp,
      age: Date.now() - item.timestamp,
    }));
  }
}

// Export singleton instance
export default new RequestQueue();
