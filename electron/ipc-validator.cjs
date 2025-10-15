/**
 * IPC Input Validation Utility
 * Provides secure validation for all IPC handler inputs
 * Prevents injection attacks and ensures type safety
 *
 * All methods are static - no need to instantiate
 */

class IPCValidator {
  /**
   * Validate string input
   * @param {any} value - Value to validate
   * @param {Object} options - Validation options
   * @returns {string} - Validated string
   * @throws {Error} - If validation fails
   */
  static validateString(value, options = {}) {
    const {
      required = false,
      maxLength = 10000,
      minLength = 0,
      pattern = null,
      allowEmpty = !required,
      sanitize = true,
    } = options;

    if (value === undefined || value === null) {
      if (required) {
        throw new Error('String value is required');
      }
      return allowEmpty ? '' : null;
    }

    if (typeof value !== 'string') {
      throw new Error(`Expected string, got ${typeof value}`);
    }

    if (!allowEmpty && value.trim().length === 0) {
      throw new Error('String cannot be empty');
    }

    if (value.length > maxLength) {
      throw new Error(`String exceeds maximum length of ${maxLength}`);
    }

    if (value.length < minLength) {
      throw new Error(`String is shorter than minimum length of ${minLength}`);
    }

    if (pattern && !pattern.test(value)) {
      throw new Error('String does not match required pattern');
    }

    // Sanitize dangerous characters if enabled
    if (sanitize) {
      // Remove null bytes
      value = value.replace(/\0/g, '');
      // Remove control characters except newlines and tabs
      value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    return value;
  }

  /**
   * Validate number input
   * @param {any} value - Value to validate
   * @param {Object} options - Validation options
   * @returns {number} - Validated number
   * @throws {Error} - If validation fails
   */
  static validateNumber(value, options = {}) {
    const { required = false, min = -Infinity, max = Infinity, integer = false } = options;

    if (value === undefined || value === null) {
      if (required) {
        throw new Error('Number value is required');
      }
      return null;
    }

    const num = Number(value);

    if (isNaN(num)) {
      throw new Error(`Expected number, got ${typeof value}`);
    }

    if (integer && !Number.isInteger(num)) {
      throw new Error('Value must be an integer');
    }

    if (num < min) {
      throw new Error(`Number must be at least ${min}`);
    }

    if (num > max) {
      throw new Error(`Number must be at most ${max}`);
    }

    return num;
  }

  /**
   * Validate boolean input
   * @param {any} value - Value to validate
   * @returns {boolean} - Validated boolean
   */
  static validateBoolean(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  }

  /**
   * Validate object input
   * @param {any} value - Value to validate
   * @param {Object} schema - Object schema
   * @returns {Object} - Validated object
   * @throws {Error} - If validation fails
   */
  static validateObject(value, schema = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Expected object');
    }

    const validated = {};

    // Validate each field according to schema
    for (const [key, fieldSchema] of Object.entries(schema)) {
      const fieldValue = value[key];

      if (fieldSchema.type === 'string') {
        validated[key] = this.validateString(fieldValue, fieldSchema);
      } else if (fieldSchema.type === 'number') {
        validated[key] = this.validateNumber(fieldValue, fieldSchema);
      } else if (fieldSchema.type === 'boolean') {
        validated[key] = this.validateBoolean(fieldValue);
      } else if (fieldSchema.type === 'object') {
        validated[key] = this.validateObject(fieldValue, fieldSchema.schema);
      } else if (fieldSchema.type === 'array') {
        validated[key] = this.validateArray(fieldValue, fieldSchema);
      }
    }

    // Check for unexpected fields (prevent injection)
    const allowedKeys = new Set(Object.keys(schema));
    const providedKeys = Object.keys(value);

    for (const key of providedKeys) {
      if (!allowedKeys.has(key)) {
        console.warn(`[IPCValidator] Unexpected field "${key}" in object`);
      }
    }

    return validated;
  }

  /**
   * Validate array input
   * @param {any} value - Value to validate
   * @param {Object} options - Validation options
   * @returns {Array} - Validated array
   * @throws {Error} - If validation fails
   */
  static validateArray(value, options = {}) {
    const { required = false, maxLength = 1000, minLength = 0, itemType = null } = options;

    if (value === undefined || value === null) {
      if (required) {
        throw new Error('Array value is required');
      }
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error('Expected array');
    }

    if (value.length > maxLength) {
      throw new Error(`Array exceeds maximum length of ${maxLength}`);
    }

    if (value.length < minLength) {
      throw new Error(`Array is shorter than minimum length of ${minLength}`);
    }

    // Validate each item if type is specified
    if (itemType) {
      return value.map((item, index) => {
        try {
          if (itemType === 'string') {
            return this.validateString(item, options.itemOptions);
          } else if (itemType === 'number') {
            return this.validateNumber(item, options.itemOptions);
          } else if (itemType === 'object') {
            return this.validateObject(item, options.itemSchema);
          }
          return item;
        } catch (err) {
          throw new Error(`Invalid item at index ${index}: ${err.message}`);
        }
      });
    }

    return value;
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @param {Object} options - Validation options
   * @returns {string} - Validated URL
   * @throws {Error} - If validation fails
   */
  static validateURL(url, options = {}) {
    const {
      required = false,
      allowedProtocols = ['http:', 'https:'],
      allowedDomains = null,
    } = options;

    const str = this.validateString(url, { required, maxLength: 2048 });

    if (!str && !required) {
      return str;
    }

    try {
      const urlObj = new URL(str);

      // Check protocol
      if (allowedProtocols && !allowedProtocols.includes(urlObj.protocol)) {
        throw new Error(`Protocol ${urlObj.protocol} not allowed`);
      }

      // Check domain whitelist
      if (allowedDomains && !allowedDomains.includes(urlObj.hostname)) {
        throw new Error(`Domain ${urlObj.hostname} not allowed`);
      }

      return urlObj.toString();
    } catch (err) {
      throw new Error(`Invalid URL: ${err.message}`);
    }
  }

  /**
   * Validate file path
   * @param {string} filepath - File path to validate
   * @param {Object} options - Validation options
   * @returns {string} - Validated file path
   * @throws {Error} - If validation fails
   */
  static validatePath(filepath, options = {}) {
    const { required = false, mustExist = false, allowTraversal = false } = options;

    const str = this.validateString(filepath, {
      required,
      maxLength: 1024,
      sanitize: false, // Don't sanitize paths
    });

    if (!str && !required) {
      return str;
    }

    // Check for path traversal attempts
    if (!allowTraversal) {
      if (str.includes('../') || str.includes('..\\')) {
        throw new Error('Path traversal not allowed');
      }
    }

    // Check for null bytes (path injection)
    if (str.includes('\0')) {
      throw new Error('Null bytes not allowed in paths');
    }

    // If mustExist, check file existence
    if (mustExist) {
      const fs = require('fs');
      if (!fs.existsSync(str)) {
        throw new Error('Path does not exist');
      }
    }

    return str;
  }

  /**
   * Validate command (for shell execution)
   * @param {string} command - Command to validate
   * @returns {string} - Validated command
   * @throws {Error} - If validation fails
   */
  static validateCommand(command) {
    const str = this.validateString(command, {
      required: true,
      maxLength: 5000,
    });

    // Dangerous command patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+\/(?:\s|$)/, // rm -rf /
      />\s*\/dev\/sda/, // Write to disk device
      /mkfs/, // Format filesystem
      /dd\s+if=/, // Disk destroyer
      /:(){ :|:& };:/, // Fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(str)) {
        throw new Error('Potentially dangerous command detected');
      }
    }

    return str;
  }

  /**
   * Create a validated IPC handler
   * @param {Function} handler - Handler function
   * @param {Object} schema - Input validation schema
   * @returns {Function} - Wrapped handler with validation
   */
  static createValidatedHandler(handler, schema) {
    return async (event, input) => {
      try {
        // Validate input against schema
        const validatedInput = schema ? this.validateObject(input || {}, schema) : input;

        // Call original handler with validated input
        return await handler(event, validatedInput);
      } catch (err) {
        console.error('[IPCValidator] Validation failed:', err.message);
        throw new Error(`Validation error: ${err.message}`);
      }
    };
  }
}

module.exports = IPCValidator;
