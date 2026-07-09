import axios from 'axios';

function getBase() {
  try {
    // Prefer dedicated telemetry URL, then API URL, then localhost
    const base = (import.meta?.env?.VITE_TELEMETRY_API || import.meta?.env?.VITE_API_URL || 'http://localhost:8000') || '';
    return (base || '').replace(/\/$/, '');
  } catch {
    return 'http://localhost:8000';
  }
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const key = import.meta?.env?.VITE_TELEMETRY_API_KEY || import.meta?.env?.VITE_API_KEY || null;
    if (key) headers['X-API-Key'] = key;
  } catch {}
  return headers;
}

/**
 * Send telemetry events to the canonical backend batch endpoint.
 * Mirrors src/services/telemetry.js behavior for compatibility with tests.
 */
export async function sendBatch(events, batchMeta = {}) {
  const base = getBase();
  const headers = buildHeaders();
  const options = { headers, timeout: 5000, validateStatus: () => true };
  const body = {
    events,
    ...batchMeta,
    timestamp: batchMeta.timestamp || Date.now(),
  };
  try {
    return await axios.post(`${base}/api/telemetry/batch`, body, options);
  } catch (e) {
    return e?.response || { status: 0 };
  }
}

export const telemetryClient = { sendBatch };

export default telemetryClient;
