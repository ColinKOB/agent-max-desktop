/**
 * Crypto Utilities
 * Real SHA-256 hashing and other crypto functions
 */

const crypto = require('crypto');

/**
 * Compute SHA-256 hash of a string (hex output)
 * @param {string} str - Input string
 * @returns {string} - Hex hash
 */
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash with prefix (for stable context hashing)
 * @param {string} str - Input string
 * @returns {string} - First 12 chars of hex hash
 */
function stableContextHash(str) {
  return sha256Hex(str).slice(0, 12);
}

/**
 * Generate a secure random ID
 * @returns {string} - Hex string (16 bytes = 32 chars)
 */
function generateSecureId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Constant-time string comparison (timing-attack safe)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if equal
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  
  if (bufA.length !== bufB.length) return false;
  
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  sha256Hex,
  stableContextHash,
  generateSecureId,
  timingSafeEqual,
};
