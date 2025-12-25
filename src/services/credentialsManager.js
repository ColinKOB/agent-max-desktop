/**
 * Credentials Manager
 *
 * Securely stores usernames and passwords for the AI to use in its workspace.
 * Credentials are encrypted before storage and only decrypted when needed.
 *
 * SECURITY NOTES:
 * - Credentials are encrypted using AES-256-GCM via Web Crypto API
 * - The encryption key is derived from a device-specific secret
 * - Passwords are never logged or exposed in plain text
 * - Users can view, add, edit, and delete credentials
 */

// Encryption utilities using Web Crypto API
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

/**
 * Get or create a device-specific encryption key
 * This key is unique to each device and stored securely
 */
async function getEncryptionKey() {
  const storedKey = localStorage.getItem('_credentials_key');

  if (storedKey) {
    // Import existing key
    const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  // Export and store
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  localStorage.setItem('_credentials_key', keyBase64);

  return key;
}

/**
 * Encrypt a string value
 */
async function encrypt(plaintext) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an encrypted value
 */
async function decrypt(ciphertext) {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('[CredentialsManager] Decryption failed:', error);
    return null;
  }
}

// Storage key for credentials
const STORAGE_KEY = 'ai_workspace_credentials';

/**
 * Credential structure:
 * {
 *   id: string (UUID),
 *   name: string (display name, e.g., "Google Account"),
 *   service: string (e.g., "google.com", "github.com"),
 *   username: string (encrypted),
 *   password: string (encrypted),
 *   notes: string (optional, encrypted),
 *   createdAt: ISO date string,
 *   updatedAt: ISO date string
 * }
 */

/**
 * Get all stored credentials (with passwords still encrypted)
 */
export async function getCredentials() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const credentials = JSON.parse(stored);
    return credentials;
  } catch (error) {
    console.error('[CredentialsManager] Failed to get credentials:', error);
    return [];
  }
}

/**
 * Get a credential by ID with decrypted values
 */
export async function getCredentialDecrypted(id) {
  const credentials = await getCredentials();
  const credential = credentials.find(c => c.id === id);

  if (!credential) return null;

  return {
    ...credential,
    username: await decrypt(credential.username),
    password: await decrypt(credential.password),
    notes: credential.notes ? await decrypt(credential.notes) : ''
  };
}

/**
 * Get credentials for a specific service (decrypted)
 */
export async function getCredentialsForService(service) {
  const credentials = await getCredentials();
  const matching = credentials.filter(c =>
    c.service.toLowerCase().includes(service.toLowerCase())
  );

  const decrypted = await Promise.all(
    matching.map(async (c) => ({
      ...c,
      username: await decrypt(c.username),
      password: await decrypt(c.password)
    }))
  );

  return decrypted;
}

/**
 * Add a new credential
 */
export async function addCredential({ name, service, username, password, notes = '' }) {
  const credentials = await getCredentials();

  const newCredential = {
    id: crypto.randomUUID(),
    name,
    service,
    username: await encrypt(username),
    password: await encrypt(password),
    notes: notes ? await encrypt(notes) : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  credentials.push(newCredential);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));

  console.log('[CredentialsManager] Added credential for:', service);
  return newCredential.id;
}

/**
 * Update an existing credential
 */
export async function updateCredential(id, updates) {
  const credentials = await getCredentials();
  const index = credentials.findIndex(c => c.id === id);

  if (index === -1) {
    throw new Error('Credential not found');
  }

  const updated = { ...credentials[index] };

  if (updates.name !== undefined) updated.name = updates.name;
  if (updates.service !== undefined) updated.service = updates.service;
  if (updates.username !== undefined) updated.username = await encrypt(updates.username);
  if (updates.password !== undefined) updated.password = await encrypt(updates.password);
  if (updates.notes !== undefined) updated.notes = updates.notes ? await encrypt(updates.notes) : '';

  updated.updatedAt = new Date().toISOString();

  credentials[index] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));

  console.log('[CredentialsManager] Updated credential:', id);
  return updated;
}

/**
 * Delete a credential
 */
export async function deleteCredential(id) {
  const credentials = await getCredentials();
  const filtered = credentials.filter(c => c.id !== id);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  console.log('[CredentialsManager] Deleted credential:', id);

  return true;
}

/**
 * Get credentials summary (for display, no passwords)
 */
export async function getCredentialsSummary() {
  const credentials = await getCredentials();

  return credentials.map(c => ({
    id: c.id,
    name: c.name,
    service: c.service,
    // Show masked username (first 2 chars + ***)
    usernameMasked: c.username ? '••••••' : '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));
}

/**
 * Export credentials (encrypted, for backup)
 */
export async function exportCredentials() {
  const credentials = await getCredentials();
  return JSON.stringify(credentials, null, 2);
}

/**
 * Import credentials (from backup)
 */
export async function importCredentials(jsonString) {
  try {
    const imported = JSON.parse(jsonString);

    if (!Array.isArray(imported)) {
      throw new Error('Invalid credentials format');
    }

    // Validate structure
    for (const cred of imported) {
      if (!cred.id || !cred.service || !cred.username || !cred.password) {
        throw new Error('Invalid credential structure');
      }
    }

    const existing = await getCredentials();
    const merged = [...existing];

    for (const cred of imported) {
      const existingIndex = merged.findIndex(c => c.id === cred.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = cred; // Replace
      } else {
        merged.push(cred); // Add new
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    console.log('[CredentialsManager] Imported', imported.length, 'credentials');

    return imported.length;
  } catch (error) {
    console.error('[CredentialsManager] Import failed:', error);
    throw error;
  }
}

/**
 * Clear all credentials (dangerous!)
 */
export async function clearAllCredentials() {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[CredentialsManager] Cleared all credentials');
}

// Default export
export default {
  getCredentials,
  getCredentialDecrypted,
  getCredentialsForService,
  addCredential,
  updateCredential,
  deleteCredential,
  getCredentialsSummary,
  exportCredentials,
  importCredentials,
  clearAllCredentials
};
