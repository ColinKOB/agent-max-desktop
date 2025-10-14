const IPCValidator = require('../../electron/ipc-validator.cjs');

describe('IPCValidator', () => {
  describe('validateString', () => {
    it('validates string correctly', () => {
      expect(IPCValidator.validateString('test')).toBe('test');
      expect(IPCValidator.validateString('')).toBe('');
      expect(IPCValidator.validateString(null)).toBe('');
    });

    it('throws on invalid string type', () => {
      expect(() => IPCValidator.validateString(123)).toThrow('Expected string');
      expect(() => IPCValidator.validateString({})).toThrow('Expected string');
    });

    it('enforces required strings', () => {
      expect(() => IPCValidator.validateString(null, { required: true })).toThrow(
        'String value is required'
      );
    });

    it('enforces length constraints', () => {
      expect(() => IPCValidator.validateString('a', { minLength: 2 })).toThrow(
        'String is shorter than minimum length'
      );
      expect(() => IPCValidator.validateString('abcdef', { maxLength: 5 })).toThrow(
        'String exceeds maximum length'
      );
    });

    it('sanitizes dangerous characters', () => {
      const input = 'test\x00\x01\x02';
      const result = IPCValidator.validateString(input, { sanitize: true });
      expect(result).toBe('test');
    });

    it('validates against pattern', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(IPCValidator.validateString('test@example.com', { pattern: emailPattern })).toBe(
        'test@example.com'
      );
      expect(() => IPCValidator.validateString('invalid', { pattern: emailPattern })).toThrow(
        'String does not match required pattern'
      );
    });
  });

  describe('validateNumber', () => {
    it('validates numbers correctly', () => {
      expect(IPCValidator.validateNumber(42)).toBe(42);
      expect(IPCValidator.validateNumber('42')).toBe(42);
      expect(IPCValidator.validateNumber(3.14)).toBe(3.14);
    });

    it('handles null/undefined', () => {
      expect(IPCValidator.validateNumber(null)).toBe(null);
      expect(IPCValidator.validateNumber(undefined)).toBe(null);
    });

    it('throws on required missing', () => {
      expect(() => IPCValidator.validateNumber(null, { required: true })).toThrow(
        'Number value is required'
      );
    });

    it('validates integer constraint', () => {
      expect(IPCValidator.validateNumber(42, { integer: true })).toBe(42);
      expect(() => IPCValidator.validateNumber(3.14, { integer: true })).toThrow(
        'Value must be an integer'
      );
    });

    it('validates range constraints', () => {
      expect(IPCValidator.validateNumber(5, { min: 0, max: 10 })).toBe(5);
      expect(() => IPCValidator.validateNumber(-1, { min: 0 })).toThrow(
        'Number must be at least 0'
      );
      expect(() => IPCValidator.validateNumber(11, { max: 10 })).toThrow(
        'Number must be at most 10'
      );
    });
  });

  describe('validateBoolean', () => {
    it('validates booleans correctly', () => {
      expect(IPCValidator.validateBoolean(true)).toBe(true);
      expect(IPCValidator.validateBoolean(false)).toBe(false);
      expect(IPCValidator.validateBoolean(1)).toBe(true);
      expect(IPCValidator.validateBoolean(0)).toBe(false);
      expect(IPCValidator.validateBoolean('yes')).toBe(true);
      expect(IPCValidator.validateBoolean('')).toBe(false);
      expect(IPCValidator.validateBoolean(null)).toBe(false);
      expect(IPCValidator.validateBoolean(undefined)).toBe(false);
    });
  });

  describe('validateObject', () => {
    it('validates objects with schema', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', integer: true, min: 0 },
        active: { type: 'boolean' },
      };

      const input = {
        name: 'John',
        age: 25,
        active: true,
      };

      const result = IPCValidator.validateObject(input, schema);
      expect(result).toEqual(input);
    });

    it('throws on invalid object type', () => {
      expect(() => IPCValidator.validateObject('not an object')).toThrow('Expected object');
      expect(() => IPCValidator.validateObject([])).toThrow('Expected object');
      expect(() => IPCValidator.validateObject(null)).toThrow('Expected object');
    });

    it('validates nested objects', () => {
      const schema = {
        user: {
          type: 'object',
          schema: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      };

      const input = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      const result = IPCValidator.validateObject(input, schema);
      expect(result).toEqual(input);
    });

    it('warns about unexpected fields', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const schema = {
        name: { type: 'string' },
      };

      const input = {
        name: 'John',
        unexpected: 'field',
      };

      IPCValidator.validateObject(input, schema);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[IPCValidator] Unexpected field "unexpected" in object'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validateArray', () => {
    it('validates arrays correctly', () => {
      expect(IPCValidator.validateArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(IPCValidator.validateArray([])).toEqual([]);
      expect(IPCValidator.validateArray(null)).toEqual([]);
    });

    it('throws on invalid array type', () => {
      expect(() => IPCValidator.validateArray('not an array')).toThrow('Expected array');
      expect(() => IPCValidator.validateArray({})).toThrow('Expected array');
    });

    it('validates array length constraints', () => {
      expect(() => IPCValidator.validateArray([1], { minLength: 2 })).toThrow(
        'Array is shorter than minimum length'
      );
      expect(() => IPCValidator.validateArray([1, 2, 3], { maxLength: 2 })).toThrow(
        'Array exceeds maximum length'
      );
    });

    it('validates array item types', () => {
      const strings = IPCValidator.validateArray(['a', 'b', 'c'], { itemType: 'string' });
      expect(strings).toEqual(['a', 'b', 'c']);

      const numbers = IPCValidator.validateArray([1, 2, 3], { itemType: 'number' });
      expect(numbers).toEqual([1, 2, 3]);

      expect(() =>
        IPCValidator.validateArray(['a', 123], { itemType: 'string' })
      ).toThrow('Invalid item at index 1');
    });
  });

  describe('validateURL', () => {
    it('validates URLs correctly', () => {
      expect(IPCValidator.validateURL('https://example.com')).toBe('https://example.com/');
      expect(IPCValidator.validateURL('http://localhost:3000')).toBe('http://localhost:3000/');
    });

    it('throws on invalid URLs', () => {
      expect(() => IPCValidator.validateURL('not a url')).toThrow('Invalid URL');
      expect(() => IPCValidator.validateURL('javascript:alert(1)')).toThrow('Protocol');
    });

    it('validates protocol whitelist', () => {
      const options = { allowedProtocols: ['https:'] };
      expect(IPCValidator.validateURL('https://example.com', options)).toBe(
        'https://example.com/'
      );
      expect(() => IPCValidator.validateURL('http://example.com', options)).toThrow(
        'Protocol http: not allowed'
      );
    });

    it('validates domain whitelist', () => {
      const options = { allowedDomains: ['example.com', 'trusted.com'] };
      expect(IPCValidator.validateURL('https://example.com', options)).toBe(
        'https://example.com/'
      );
      expect(() => IPCValidator.validateURL('https://evil.com', options)).toThrow(
        'Domain evil.com not allowed'
      );
    });
  });

  describe('validatePath', () => {
    it('validates paths correctly', () => {
      expect(IPCValidator.validatePath('/usr/local/bin')).toBe('/usr/local/bin');
      expect(IPCValidator.validatePath('./relative/path')).toBe('./relative/path');
    });

    it('prevents path traversal by default', () => {
      expect(() => IPCValidator.validatePath('../etc/passwd')).toThrow(
        'Path traversal not allowed'
      );
      expect(() => IPCValidator.validatePath('../../secrets')).toThrow(
        'Path traversal not allowed'
      );
    });

    it('allows path traversal when explicitly enabled', () => {
      expect(IPCValidator.validatePath('../parent', { allowTraversal: true })).toBe('../parent');
    });

    it('prevents null byte injection', () => {
      expect(() => IPCValidator.validatePath('/etc/passwd\x00.txt')).toThrow(
        'Null bytes not allowed in paths'
      );
    });
  });

  describe('validateCommand', () => {
    it('validates safe commands', () => {
      expect(IPCValidator.validateCommand('ls -la')).toBe('ls -la');
      expect(IPCValidator.validateCommand('echo "hello"')).toBe('echo "hello"');
      expect(IPCValidator.validateCommand('git status')).toBe('git status');
    });

    it('detects dangerous commands', () => {
      expect(() => IPCValidator.validateCommand('rm -rf /')).toThrow(
        'Potentially dangerous command detected'
      );
      expect(() => IPCValidator.validateCommand('mkfs /dev/sda')).toThrow(
        'Potentially dangerous command detected'
      );
      expect(() => IPCValidator.validateCommand('dd if=/dev/zero of=/dev/sda')).toThrow(
        'Potentially dangerous command detected'
      );
    });

    it('enforces required command', () => {
      expect(() => IPCValidator.validateCommand('')).toThrow('String cannot be empty');
    });
  });

  describe('createValidatedHandler', () => {
    it('creates validated handler wrapper', async () => {
      const handler = jest.fn().mockResolvedValue({ success: true });
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', min: 0 },
      };

      const validatedHandler = IPCValidator.createValidatedHandler(handler, schema);

      const event = {};
      const input = { name: 'John', age: 25 };

      const result = await validatedHandler(event, input);

      expect(handler).toHaveBeenCalledWith(event, input);
      expect(result).toEqual({ success: true });
    });

    it('validates input before calling handler', async () => {
      const handler = jest.fn();
      const schema = {
        name: { type: 'string', required: true },
      };

      const validatedHandler = IPCValidator.createValidatedHandler(handler, schema);

      const event = {};
      const invalidInput = { name: 123 }; // Invalid type

      await expect(validatedHandler(event, invalidInput)).rejects.toThrow(
        'Validation error: Expected string'
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('passes through handler errors', async () => {
      const handlerError = new Error('Handler failed');
      const handler = jest.fn().mockRejectedValue(handlerError);
      const schema = {};

      const validatedHandler = IPCValidator.createValidatedHandler(handler, schema);

      const event = {};
      const input = {};

      await expect(validatedHandler(event, input)).rejects.toThrow('Handler failed');
    });

    it('logs validation errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const handler = jest.fn();
      const schema = {
        required: { type: 'string', required: true },
      };

      const validatedHandler = IPCValidator.createValidatedHandler(handler, schema);

      try {
        await validatedHandler({}, {});
      } catch (e) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '[IPCValidator] Validation failed:',
        'String value is required'
      );

      consoleSpy.mockRestore();
    });
  });
});
