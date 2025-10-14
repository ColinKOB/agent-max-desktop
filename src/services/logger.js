/**
 * Structured Logging Service
 * Provides consistent logging across the application
 */

// Log levels
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// Log level names
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL'
};

// Log colors for console output
const LogColors = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m',  // Green
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  [LogLevel.FATAL]: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'
};

class Logger {
  constructor(options = {}) {
    this.minLevel = options.minLevel ?? (process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO);
    this.context = options.context || 'App';
    this.enableConsole = options.enableConsole ?? true;
    this.enableRemote = options.enableRemote ?? false;
    this.maxBufferSize = options.maxBufferSize || 1000;
    this.buffer = [];
    this.metadata = options.metadata || {};
  }

  /**
   * Set global metadata for all logs
   */
  setMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Create log entry
   */
  createLogEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevelNames[level],
      context: this.context,
      message,
      data,
      metadata: this.metadata,
      ...this.getEnvironmentInfo()
    };
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    return {
      env: process.env.NODE_ENV,
      platform: navigator?.platform,
      userAgent: navigator?.userAgent,
      url: window?.location?.href
    };
  }

  /**
   * Format message for console
   */
  formatConsoleMessage(entry) {
    const color = LogColors[Object.keys(LogLevelNames).find(key => LogLevelNames[key] === entry.level)] || '';
    const reset = LogColors.RESET;
    
    let message = `${color}[${entry.timestamp}] [${entry.context}] ${entry.level}: ${entry.message}${reset}`;
    
    if (Object.keys(entry.data).length > 0) {
      message += `\n${JSON.stringify(entry.data, null, 2)}`;
    }
    
    return message;
  }

  /**
   * Write log entry
   */
  writeLog(level, message, data = {}) {
    if (level < this.minLevel) {
      return;
    }

    const entry = this.createLogEntry(level, message, data);

    // Add to buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Console output
    if (this.enableConsole) {
      const consoleMethod = level >= LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
      console[consoleMethod](this.formatConsoleMessage(entry));
    }

    // Remote logging (if enabled)
    if (this.enableRemote && level >= LogLevel.WARN) {
      this.sendToRemote(entry);
    }

    // Save critical errors to file (Electron only)
    if (level >= LogLevel.ERROR && window.electron?.logger) {
      window.electron.logger.writeToFile(entry);
    }

    return entry;
  }

  /**
   * Send log to remote service
   */
  async sendToRemote(entry) {
    try {
      // Implement remote logging (e.g., to your logging service)
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (error) {
      console.error('[Logger] Failed to send log to remote:', error);
    }
  }

  // Log methods
  debug(message, data) {
    return this.writeLog(LogLevel.DEBUG, message, data);
  }

  info(message, data) {
    return this.writeLog(LogLevel.INFO, message, data);
  }

  warn(message, data) {
    return this.writeLog(LogLevel.WARN, message, data);
  }

  error(message, error) {
    const data = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...error
    } : error;
    
    return this.writeLog(LogLevel.ERROR, message, data);
  }

  fatal(message, error) {
    const data = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...error
    } : error;
    
    return this.writeLog(LogLevel.FATAL, message, data);
  }

  /**
   * Measure performance
   */
  startTimer(label) {
    const startTime = performance.now();
    return {
      end: (message) => {
        const duration = performance.now() - startTime;
        this.debug(`${label}: ${message}`, { duration: `${duration.toFixed(2)}ms` });
        return duration;
      }
    };
  }

  /**
   * Create child logger with additional context
   */
  child(context, metadata = {}) {
    return new Logger({
      ...this,
      context: `${this.context}:${context}`,
      metadata: { ...this.metadata, ...metadata }
    });
  }

  /**
   * Get buffered logs
   */
  getBuffer(count = 10) {
    return this.buffer.slice(-count);
  }

  /**
   * Clear buffer
   */
  clearBuffer() {
    this.buffer = [];
  }

  /**
   * Export logs
   */
  exportLogs() {
    return {
      logs: this.buffer,
      metadata: this.metadata,
      exported_at: new Date().toISOString()
    };
  }
}

// Create default logger instance
const defaultLogger = new Logger({
  context: 'AgentMax',
  enableConsole: process.env.NODE_ENV === 'development',
  minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
});

// Factory function to create component-specific loggers
export const createLogger = (context, options = {}) => {
  return defaultLogger.child(context, options);
};

// Performance monitoring utilities
export const performance = {
  mark: (name) => {
    if (window.performance?.mark) {
      window.performance.mark(name);
    }
  },
  
  measure: (name, startMark, endMark) => {
    if (window.performance?.measure) {
      window.performance.measure(name, startMark, endMark);
      const entries = window.performance.getEntriesByName(name, 'measure');
      const duration = entries[entries.length - 1]?.duration;
      defaultLogger.debug(`Performance: ${name}`, { duration: `${duration?.toFixed(2)}ms` });
      return duration;
    }
  },
  
  clearMarks: () => {
    if (window.performance?.clearMarks) {
      window.performance.clearMarks();
    }
  }
};

// Trace function execution
export const trace = (fn, name) => {
  return function(...args) {
    const timer = defaultLogger.startTimer(name || fn.name || 'Anonymous');
    try {
      const result = fn.apply(this, args);
      if (result instanceof Promise) {
        return result.finally(() => timer.end('completed'));
      }
      timer.end('completed');
      return result;
    } catch (error) {
      timer.end('failed');
      throw error;
    }
  };
};

// Log React component lifecycle
export const logComponent = (componentName) => {
  const logger = createLogger(`Component:${componentName}`);
  
  return {
    mount: () => logger.debug('Mounted'),
    unmount: () => logger.debug('Unmounted'),
    render: () => logger.debug('Rendered'),
    update: (props) => logger.debug('Updated', { props }),
    error: (error) => logger.error('Component error', error)
  };
};

// Export default instance
export default defaultLogger;

// Named exports for convenience
export {
  defaultLogger as logger,
  Logger
};
