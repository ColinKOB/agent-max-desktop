/**
 * Memory API client for Better Memory system.
 * 
 * Provides functions to interact with the memory backend:
 * - Retrieval: Query context packs
 * - Facts: CRUD operations
 * - Messages: Save and retrieve
 */
import apiConfigManager from '../config/apiConfig';

// Resolve API base consistently with the rest of the app
function getApiBase() {
  try {
    const cfg = apiConfigManager.getConfig?.() || {};
    return cfg.baseURL || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000';
  } catch (_) {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000';
  }
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const key = apiConfigManager.getApiKey?.();
    if (key) headers['X-API-Key'] = key;
  } catch {}
  try {
    const userId = (typeof localStorage !== 'undefined' && localStorage.getItem('user_id')) || null;
    if (userId) headers['X-User-Id'] = userId;
  } catch {}
  return headers;
}

/**
 * Query memory retrieval endpoint.
 * Returns a context pack with facts, semantic hits, and recent messages.
 * 
 * @param {Object} params - Retrieval parameters
 * @param {string} params.text - Query text
 * @param {number} [params.k_facts=8] - Number of facts to retrieve
 * @param {number} [params.k_sem=6] - Number of semantic hits
 * @param {number} [params.token_budget=900] - Token budget cap
 * @param {boolean} [params.allow_vectors=false] - Use vector search
 * @param {string} [params.workspace_id] - Workspace scope
 * @returns {Promise<Object>} RetrievalPack with facts, semantic_hits, recent_messages, rationale, budget
 */
export async function query(params) {
  const base = getApiBase();
  const endpoints = [
    `${base}/api/v2/memory/retrieval/query`,
    `${base}/api/memory/retrieval/query`,
  ];
  const payload = {
    text: params.text,
    k_facts: params.k_facts || 8,
    k_sem: params.k_sem || 6,
    token_budget: params.token_budget || 900,
    allow_vectors: params.allow_vectors || false,
    workspace_id: params.workspace_id || null,
  };
  let lastStatus = 0;
  let lastBody = '';
  for (const url of endpoints) {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      return response.json();
    }
    lastStatus = response.status;
    try { lastBody = await response.text(); } catch {}
    if (lastStatus === 404 || lastStatus === 405) continue;
    // For 401, no benefit to try alternative path without auth
    if (lastStatus === 401) break;
  }
  let message = `Retrieval failed: ${lastStatus}`;
  try {
    const parsed = lastBody && JSON.parse(lastBody);
    if (parsed && (parsed.detail || parsed.error)) message = parsed.detail || parsed.error;
  } catch {}
  throw new Error(message);
}

/**
 * Get all facts with optional filtering.
 * 
 * @param {Object} [filters={}] - Filter options
 * @param {string} [filters.category] - Filter by category
 * @param {boolean} [filters.pinned_only=false] - Only pinned facts
 * @param {boolean} [filters.include_tombstoned=false] - Include deleted facts
 * @returns {Promise<Array>} Array of Fact objects
 */
export async function getFacts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.append('category', filters.category);
  if (filters.pinned_only) params.append('pinned_only', 'true');
  if (filters.include_tombstoned) params.append('include_tombstoned', 'true');

  const base = getApiBase();
  const url = `${base}/api/memory/facts${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to get facts: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a specific fact by ID.
 * 
 * @param {string} id - Fact UUID
 * @returns {Promise<Object>} Fact object
 */
export async function getFact(id) {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/facts/${id}`, { headers: buildHeaders() });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Fact not found');
    }
    throw new Error(`Failed to get fact: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new fact.
 * 
 * @param {Object} factData - Fact data
 * @param {string} factData.category - Fact category
 * @param {string} factData.key - Fact key
 * @param {string} factData.value - Fact value
 * @param {number} [factData.confidence=0.9] - Confidence 0-1
 * @param {boolean} [factData.pinned=false] - Pin this fact
 * @returns {Promise<Object>} Created Fact object
 */
export async function createFact(factData) {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/facts`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(factData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to create fact: ${response.status}`);
  }

  return response.json();
}

/**
 * Update an existing fact.
 * 
 * @param {string} id - Fact UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated Fact object
 */
export async function updateFact(id, updates) {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/facts/${id}`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to update fact: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a fact (soft delete by default).
 * 
 * @param {string} id - Fact UUID
 * @param {boolean} [hardDelete=false] - Permanently delete vs tombstone
 * @returns {Promise<void>}
 */
export async function deleteFact(id, hardDelete = false) {
  const params = hardDelete ? '?hard_delete=true' : '';
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/facts/${id}${params}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Fact not found');
    }
    throw new Error(`Failed to delete fact: ${response.status}`);
  }
}

/**
 * Save a conversation message.
 * 
 * @param {Object} messageData - Message data
 * @param {string} messageData.role - Message role (user, assistant, system)
 * @param {string} messageData.content - Message content
 * @param {string} [messageData.session_id] - Session UUID
 * @returns {Promise<Object>} Saved Message object
 */
export async function saveMessage(messageData) {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/messages`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to save message: ${response.status}`);
  }

  return response.json();
}

/**
 * Get recent messages.
 * 
 * @param {Object} [options={}] - Options
 * @param {number} [options.limit=10] - Number of messages
 * @param {string} [options.session_id] - Filter by session
 * @returns {Promise<Array>} Array of Message objects
 */
export async function getMessages(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.session_id) params.append('session_id', options.session_id);

  const base = getApiBase();
  const url = `${base}/api/memory/messages${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`);
  }

  return response.json();
}

/**
 * Get memory statistics.
 * 
 * @returns {Promise<Object>} Stats object with total_facts, pinned_facts, total_messages, categories
 */
export async function getStats() {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/stats`, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to get stats: ${response.status}`);
  }

  return response.json();
}

/**
 * Check memory system health.
 * 
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/health`, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Extract facts from a user/assistant message (Phase 2)
 * @param {{message: string, source_msg_id?: string}} payload
 * @returns {Promise<Array>} Array of ExtractionProposal
 */
export async function extract(payload) {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/extract`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Extraction failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Apply confirmed extraction proposals (Phase 2)
 * @param {{proposals: Array, confirmed: Array<string>}} payload
 * @returns {Promise<Object>} Apply result summary
 */
export async function apply(payload) {
  const base = getApiBase();
  const response = await fetch(`${base}/api/memory/apply`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Apply failed: ${response.status}`);
  }

  return response.json();
}

// Export all functions as default object
const memoryAPI = {
  query,
  getFacts,
  getFact,
  createFact,
  updateFact,
  deleteFact,
  saveMessage,
  getMessages,
  getStats,
  checkHealth,
  extract,
  apply,
};

export default memoryAPI;
