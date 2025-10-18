/**
 * HMAC Message Verifier for Frontend
 * 
 * Verifies HMAC signatures on messages from backend and signs outgoing messages.
 * Provides security against message tampering and replay attacks.
 */

const crypto = require('crypto');

class HMACVerifier {
  constructor() {
    this.masterSecret = null;
    this.replayWindowSeconds = 300; // 5 minutes
  }

  /**
   * Initialize with master secret from environment
   */
  init() {
    this.masterSecret = process.env.HMAC_MASTER_SECRET;
    
    if (!this.masterSecret) {
      throw new Error('HMAC_MASTER_SECRET not set in environment');
    }
    
    console.log('[HMACVerifier] Initialized with master secret');
  }

  /**
   * Verify a signed message from backend
   * 
   * @param {Object} signedMessage - Signed message with signature
   * @returns {Object} {valid, message, error}
   */
  verify(signedMessage) {
    try {
      if (!this.masterSecret) {
        this.init();
      }

      // Extract signature and message
      const { signature, message } = signedMessage;
      
      if (!signature || !message) {
        return {
          valid: false,
          message: null,
          error: 'Missing signature or message'
        };
      }

      // Check timestamp
      const timestamp = message.timestamp;
      if (!timestamp) {
        return {
          valid: false,
          message: null,
          error: 'Missing timestamp'
        };
      }

      // Verify timestamp is recent (replay protection)
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = currentTime - timestamp;

      if (timeDiff > this.replayWindowSeconds) {
        return {
          valid: false,
          message: null,
          error: `Message too old: ${timeDiff}s (max ${this.replayWindowSeconds}s)`
        };
      }

      if (timeDiff < -60) { // Allow 60s clock skew
        return {
          valid: false,
          message: null,
          error: 'Message timestamp is in the future'
        };
      }

      // Recompute signature
      const messageJson = JSON.stringify(message, Object.keys(message).sort());
      const expectedSignature = crypto
        .createHmac('sha256', this.masterSecret)
        .update(messageJson)
        .digest('hex');

      // Compare signatures (constant-time comparison)
      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )) {
        return {
          valid: false,
          message: null,
          error: 'Invalid signature'
        };
      }

      // Remove timestamp before returning
      const originalMessage = { ...message };
      delete originalMessage.timestamp;

      return {
        valid: true,
        message: originalMessage,
        error: null
      };

    } catch (error) {
      return {
        valid: false,
        message: null,
        error: `Verification error: ${error.message}`
      };
    }
  }

  /**
   * Sign a message before sending to backend
   * 
   * @param {Object} message - Message to sign
   * @returns {Object} Signed message with signature
   */
  sign(message) {
    if (!this.masterSecret) {
      this.init();
    }

    // Add timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const messageWithTimestamp = {
      ...message,
      timestamp
    };

    // Create signature
    const messageJson = JSON.stringify(
      messageWithTimestamp,
      Object.keys(messageWithTimestamp).sort()
    );
    
    const signature = crypto
      .createHmac('sha256', this.masterSecret)
      .update(messageJson)
      .digest('hex');

    return {
      message: messageWithTimestamp,
      signature
    };
  }

  /**
   * Unwrap and verify WebSocket message
   * 
   * @param {string} messageJson - JSON string of signed message
   * @returns {Object} {valid, message, error}
   */
  unwrapWebSocketMessage(messageJson) {
    try {
      const signedMessage = JSON.parse(messageJson);
      return this.verify(signedMessage);
    } catch (error) {
      return {
        valid: false,
        message: null,
        error: `Invalid JSON: ${error.message}`
      };
    }
  }

  /**
   * Sign and wrap WebSocket message
   * 
   * @param {Object} message - Message to sign
   * @returns {string} JSON string of signed message
   */
  wrapWebSocketMessage(message) {
    const signed = this.sign(message);
    return JSON.stringify(signed);
  }
}

// Singleton instance
let hmacVerifier = null;

function getHMACVerifier() {
  if (!hmacVerifier) {
    hmacVerifier = new HMACVerifier();
  }
  return hmacVerifier;
}

module.exports = {
  HMACVerifier,
  getHMACVerifier
};
