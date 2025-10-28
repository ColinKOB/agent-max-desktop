/**
 * Tests for Hands on Desktop Client
 * 
 * Tests SSE connection, shell execution, HMAC signing, and result submission
 */

const { HandsOnDesktopClient } = require('../electron/hands-on-desktop-client.cjs');
const EventEmitter = require('events');
const crypto = require('crypto');

// Mock EventSource
class MockEventSource extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0; // CONNECTING
    
    // Simulate connection after a delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.emit('open');
    }, 10);
  }
  
  close() {
    this.readyState = 2; // CLOSED
  }
  
  // Helper to simulate receiving an event
  simulateEvent(type, data) {
    this.emit(type, { data: JSON.stringify(data) });
  }
}

// Mock fetch
global.fetch = jest.fn();

describe('HandsOnDesktopClient', () => {
  let client;
  const testBackendUrl = 'http://localhost:8000';
  const testDeviceToken = 'test-token-123';
  const testDeviceSecret = 'test-secret-456';
  
  beforeEach(() => {
    client = new HandsOnDesktopClient(testBackendUrl, testDeviceToken, testDeviceSecret);
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });
  
  describe('Initialization', () => {
    test('should initialize with correct parameters', () => {
      expect(client.backendUrl).toBe(testBackendUrl);
      expect(client.deviceToken).toBe(testDeviceToken);
      expect(client.deviceSecret).toBe(testDeviceSecret);
      expect(client.isConnected).toBe(false);
    });
    
    test('should have correct default settings', () => {
      expect(client.reconnectDelay).toBe(1000);
      expect(client.maxReconnectDelay).toBe(30000);
    });
  });
  
  describe('HMAC Signature Generation', () => {
    test('should generate valid HMAC signature', () => {
      const result = {
        request_id: 'req-123',
        run_id: 'run-456',
        step: 1,
        tool: 'shell',
        success: true,
        exit_code: 0,
        stdout: 'test output',
        stderr: '',
        duration_ms: 100
      };
      
      const signature = client.signResult(result);
      
      // Verify it's a hex string
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
      
      // Verify it's deterministic
      const signature2 = client.signResult(result);
      expect(signature).toBe(signature2);
      
      // Verify it changes with different data
      const result2 = { ...result, stdout: 'different output' };
      const signature3 = client.signResult(result2);
      expect(signature).not.toBe(signature3);
    });
    
    test('should match backend HMAC format', () => {
      const result = {
        request_id: 'req-abc',
        run_id: 'run-xyz',
        step: 2,
        tool: 'shell',
        success: true,
        exit_code: 0,
        stdout: 'hello',
        stderr: '',
        duration_ms: 50
      };
      
      // Generate signature using same method as backend
      const canonical = `${result.run_id}:${result.request_id}:${result.step}:${JSON.stringify(result)}`;
      const expectedSignature = crypto
        .createHmac('sha256', testDeviceSecret)
        .update(canonical)
        .digest('hex');
      
      const actualSignature = client.signResult(result);
      
      expect(actualSignature).toBe(expectedSignature);
    });
  });
  
  describe('Shell Command Execution', () => {
    test('should execute simple command successfully', async () => {
      const result = await client.executeShellCommand('echo "test"', false, 10);
      
      expect(result.success).toBe(true);
      expect(result.exit_code).toBe(0);
      expect(result.stdout).toContain('test');
      expect(result.duration_ms).toBeGreaterThan(0);
    });
    
    test('should handle command errors', async () => {
      const result = await client.executeShellCommand('nonexistent-command', false, 10);
      
      expect(result.success).toBe(false);
      expect(result.exit_code).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });
    
    test('should return error for sudo commands without modal', async () => {
      // Sudo modal not wired up yet, should return error
      const result = await client.executeShellCommand('sudo ls', true, 10);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('denied');
    });
    
    test('should measure execution duration', async () => {
      const startTime = Date.now();
      const result = await client.executeShellCommand('sleep 0.1', false, 10);
      const endTime = Date.now();
      
      expect(result.duration_ms).toBeGreaterThan(50);
      expect(result.duration_ms).toBeLessThan(endTime - startTime + 50);
    });
  });
  
  describe('Result Submission', () => {
    test('should submit result with correct headers', async () => {
      const result = {
        request_id: 'req-123',
        run_id: 'run-456',
        step: 1,
        tool: 'shell',
        success: true,
        exit_code: 0,
        stdout: 'output',
        stderr: '',
        duration_ms: 100,
        timestamp: new Date().toISOString()
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });
      
      await client.submitResult(result);
      
      expect(global.fetch).toHaveBeenCalledWith(
        `${testBackendUrl}/api/v2/autonomous/tool-result`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${testDeviceToken}`,
            'X-Request-ID': result.request_id,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(result)
        })
      );
    });
    
    test('should include HMAC signature in headers', async () => {
      const result = {
        request_id: 'req-789',
        run_id: 'run-abc',
        step: 3,
        tool: 'shell',
        success: true,
        exit_code: 0,
        stdout: 'test',
        stderr: '',
        duration_ms: 50,
        timestamp: new Date().toISOString()
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });
      
      await client.submitResult(result);
      
      const expectedSignature = client.signResult(result);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Run-Signature': expectedSignature
          })
        })
      );
    });
    
    test('should handle submission errors gracefully', async () => {
      const result = {
        request_id: 'req-error',
        run_id: 'run-error',
        step: 1,
        tool: 'shell',
        success: true,
        exit_code: 0,
        stdout: '',
        stderr: '',
        duration_ms: 10,
        timestamp: new Date().toISOString()
      };
      
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Should not throw
      await expect(client.submitResult(result)).resolves.not.toThrow();
    });
  });
  
  describe('Tool Request Handling', () => {
    test('should execute and submit result for tool request', async () => {
      const toolRequest = {
        request_id: 'req-test-123',
        run_id: 'run-test-456',
        step: 1,
        tool: 'shell',
        command: 'echo "integration test"',
        requires_elevation: false,
        timeout_sec: 30
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });
      
      await client.handleToolRequest(toolRequest);
      
      // Verify result was submitted
      expect(global.fetch).toHaveBeenCalled();
      
      const callArgs = global.fetch.mock.calls[0];
      const submittedBody = JSON.parse(callArgs[1].body);
      
      expect(submittedBody.request_id).toBe(toolRequest.request_id);
      expect(submittedBody.run_id).toBe(toolRequest.run_id);
      expect(submittedBody.step).toBe(toolRequest.step);
      expect(submittedBody.success).toBe(true);
      expect(submittedBody.stdout).toContain('integration test');
    });
    
    test('should handle unsupported tools', async () => {
      const toolRequest = {
        request_id: 'req-unsupported',
        run_id: 'run-unsupported',
        step: 1,
        tool: 'unsupported-tool',
        command: 'test',
        requires_elevation: false,
        timeout_sec: 30
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });
      
      await client.handleToolRequest(toolRequest);
      
      const callArgs = global.fetch.mock.calls[0];
      const submittedBody = JSON.parse(callArgs[1].body);
      
      expect(submittedBody.success).toBe(false);
      expect(submittedBody.stderr).toContain('Unsupported tool');
    });
  });
  
  describe('Connection Status', () => {
    test('should return correct status when disconnected', () => {
      const status = client.getStatus();
      
      expect(status.connected).toBe(false);
      expect(status.backendUrl).toBe(testBackendUrl);
      expect(status.reconnectDelay).toBe(1000);
    });
  });
});
