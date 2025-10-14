import '@testing-library/jest-dom';

// Mock Electron API for tests
global.window.electron = {
  memory: {
    getAllSessions: jest.fn().mockResolvedValue([]),
    getSessionById: jest.fn(),
    addMessage: jest.fn(),
    startSession: jest.fn(),
    getProfile: jest.fn().mockResolvedValue({ name: 'Test User' }),
    updateProfile: jest.fn(),
    getFacts: jest.fn().mockResolvedValue({}),
    setFact: jest.fn(),
    getPreferences: jest.fn().mockResolvedValue({}),
    setPreference: jest.fn(),
  },
  dialog: {
    showErrorBox: jest.fn(),
  },
  logger: {
    writeToFile: jest.fn(),
  },
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to reduce test output noise
const originalError = console.error;
const originalWarn = console.warn;
global.console.error = jest.fn((...args) => {
  // Only log actual errors, not React errors about missing props etc
  if (!args[0]?.includes?.('Warning:') && !args[0]?.includes?.('Each child')) {
    originalError(...args);
  }
});
global.console.warn = jest.fn((...args) => {
  // Filter out expected warnings
  if (!args[0]?.includes?.('componentWillReceiveProps')) {
    originalWarn(...args);
  }
});
