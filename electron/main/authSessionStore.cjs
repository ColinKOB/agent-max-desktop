const fs = require('fs');
const path = require('path');

const STORE_FILENAME = 'auth-session.bin';
const MAX_KEY_LENGTH = 512;
const MAX_VALUE_LENGTH = 5 * 1024 * 1024;

function registerAuthSessionStore({ app, ipcMain, safeStorage }) {
  let plaintextWarningLogged = false;

  function validateKey(key) {
    if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new Error('Invalid auth session storage key');
    }
    return key;
  }

  function validateValue(value) {
    if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) {
      throw new Error('Invalid auth session storage value');
    }
    return value;
  }

  function getStorePath() {
    return path.join(app.getPath('userData'), STORE_FILENAME);
  }

  function isEncryptionAvailable() {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch (error) {
      console.warn('[AuthSessionStore] Could not check safeStorage availability:', error.message);
      return false;
    }
  }

  function warnAboutPlaintextStorage() {
    if (plaintextWarningLogged) return;
    plaintextWarningLogged = true;
    console.warn('[AuthSessionStore] safeStorage encryption is unavailable. Auth session data will be stored as plaintext.');
  }

  function deserializeStore(contents) {
    let serialized;
    if (isEncryptionAvailable()) {
      try {
        serialized = safeStorage.decryptString(contents);
      } catch (error) {
        console.warn('[AuthSessionStore] Could not decrypt the auth session store. Treating the user as signed out.');
        return null;
      }
    } else {
      warnAboutPlaintextStorage();
      serialized = contents.toString('utf8');
    }

    try {
      const parsed = JSON.parse(serialized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch (error) {
      console.warn('[AuthSessionStore] Could not parse the auth session store. Treating the user as signed out.');
      return null;
    }
  }

  function readStore() {
    const storePath = getStorePath();
    if (!fs.existsSync(storePath)) return Object.create(null);

    try {
      return deserializeStore(fs.readFileSync(storePath));
    } catch (error) {
      console.warn('[AuthSessionStore] Could not read the auth session store. Treating the user as signed out.');
      return null;
    }
  }

  function serializeStore(store) {
    const serialized = JSON.stringify(store);
    if (isEncryptionAvailable()) {
      return safeStorage.encryptString(serialized);
    }

    warnAboutPlaintextStorage();
    return Buffer.from(serialized, 'utf8');
  }

  function writeStore(store) {
    const storePath = getStorePath();
    const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    const contents = serializeStore(store);
    let fileDescriptor;

    fs.mkdirSync(path.dirname(storePath), { recursive: true });

    try {
      fileDescriptor = fs.openSync(tempPath, 'wx', 0o600);
      fs.writeFileSync(fileDescriptor, contents);
      fs.fsyncSync(fileDescriptor);
      fs.closeSync(fileDescriptor);
      fileDescriptor = undefined;
      fs.renameSync(tempPath, storePath);
    } catch (error) {
      if (fileDescriptor !== undefined) {
        try { fs.closeSync(fileDescriptor); } catch {}
      }
      try { fs.unlinkSync(tempPath); } catch {}
      throw error;
    }
  }

  ipcMain.handle('auth-session:get', (_event, key) => {
    const validatedKey = validateKey(key);
    const store = readStore();
    if (!store || !Object.prototype.hasOwnProperty.call(store, validatedKey)) return null;
    return typeof store[validatedKey] === 'string' ? store[validatedKey] : null;
  });

  ipcMain.handle('auth-session:set', (_event, key, value) => {
    const validatedKey = validateKey(key);
    const validatedValue = validateValue(value);
    const store = readStore() || Object.create(null);
    store[validatedKey] = validatedValue;
    writeStore(store);
  });

  ipcMain.handle('auth-session:remove', (_event, key) => {
    const validatedKey = validateKey(key);
    const store = readStore() || Object.create(null);
    delete store[validatedKey];
    writeStore(store);
  });
}

module.exports = { registerAuthSessionStore };
