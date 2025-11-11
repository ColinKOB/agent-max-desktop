import axios from 'axios';

const getLocal = (k, fallback = null) => {
  try {
    return (typeof localStorage !== 'undefined') ? (localStorage.getItem(k) || fallback) : fallback;
  } catch {
    return fallback;
  }
};

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
 * Send telemetry events using legacy PUT first, then fall back to v2 POST.
 * Mirrors src/services/telemetry.js behavior for compatibility with tests.
 */
export async function sendBatch(events) {
  const base = getBase();
  const headers = buildHeaders();
  const options = { headers, timeout: 5000, validateStatus: () => true };

  // Try legacy first
  let res;
  try {
    res = await axios.put(`${base}/api/telemetry/batch`, { events }, options);
  } catch {
    res = { status: 0 };
  }

  if (res && (res.status === 404 || res.status === 405 || res.status === 0 || (res.status >= 400 && res.status < 600))) {
    try {
      res = await axios.post(`${base}/api/v2/telemetry/batch`, { events }, options);
    } catch (e) {
      res = e?.response || { status: 0 };
    }
  }
  return res;
}

export const telemetryClient = { sendBatch };

export default telemetryClient;
