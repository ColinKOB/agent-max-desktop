/**
 * Test Setup File
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock global.window if it doesn't exist
if (typeof window === 'undefined') {
  global.window = {};
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
