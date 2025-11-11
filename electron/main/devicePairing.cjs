/**
 * Device Pairing - Hands on Desktop Protocol
 * 
 * Handles one-time device pairing with backend to obtain credentials
 * for secure tool result submission.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class DevicePairing {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
    this.credentialsPath = path.join(os.homedir(), '.agent_max', 'device_credentials.json');
  }

  /**
   * Get or create device credentials
   * 
   * Returns cached credentials if valid, otherwise pairs with backend.
   */
  async getCredentials(userId = 'default_user') {
    // Try to load cached credentials
    try {
      const cached = await this.loadCredentials();
      if (cached && !this.isExpired(cached)) {
        console.log('[DevicePairing] Using cached credentials');
        return cached;
      }
    } catch (err) {
      console.log('[DevicePairing] No cached credentials found');
    }

    // Pair with backend
    console.log('[DevicePairing] Pairing with backend...');
    const credentials = await this.pairWithBackend(userId);
    
    // Cache credentials
    await this.saveCredentials(credentials);
    
    return credentials;
  }

  /**
   * Pair with backend to get device credentials
   */
  async pairWithBackend(userId) {
    const deviceId = this.getOrCreateDeviceId();
    
    const response = await fetch(`${this.backendUrl}/api/v2/autonomous/device/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        device_id: deviceId,
        user_id: userId
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Device pairing failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    console.log('[DevicePairing] Paired successfully:', {
      device_id: data.device_id,
      expires_at: new Date(data.expires_at * 1000).toISOString()
    });

    return {
      device_id: data.device_id,
      device_token: data.device_token,
      device_secret: data.device_secret,
      expires_at: data.expires_at
    };
  }

  /**
   * Get or create persistent device ID
   */
  getOrCreateDeviceId() {
    const deviceIdPath = path.join(os.homedir(), '.agent_max', 'device_id.txt');
    
    try {
      const deviceId = require('fs').readFileSync(deviceIdPath, 'utf8').trim();
      if (deviceId) {
        return deviceId;
      }
    } catch (err) {
      // File doesn't exist, create new ID
    }

    // Generate new device ID
    const deviceId = `device-${crypto.randomUUID()}`;
    
    // Save it
    const dir = path.dirname(deviceIdPath);
    if (!require('fs').existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    require('fs').writeFileSync(deviceIdPath, deviceId, 'utf8');
    
    console.log('[DevicePairing] Created new device ID:', deviceId);
    return deviceId;
  }

  /**
   * Load cached credentials from disk
   */
  async loadCredentials() {
    const data = await fs.readFile(this.credentialsPath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Save credentials to disk
   */
  async saveCredentials(credentials) {
    const dir = path.dirname(this.credentialsPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
    console.log('[DevicePairing] Credentials saved to:', this.credentialsPath);
  }

  /**
   * Check if credentials are expired
   */
  isExpired(credentials) {
    if (!credentials.expires_at) {
      return true;
    }
    const now = Date.now() / 1000;
    // Consider expired if less than 1 day remaining
    return credentials.expires_at - now < 86400;
  }

  /**
   * Compute HMAC signature for tool result
   */
  signResult(result, deviceSecret) {
    // Create canonical payload (same as backend)
    const canonical = `${result.run_id}:${result.request_id}:${result.step}:${JSON.stringify(result)}`;
    
    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', deviceSecret);
    hmac.update(canonical);
    return hmac.digest('hex');
  }
}

module.exports = { DevicePairing };
