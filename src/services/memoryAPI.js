/**
 * Memory API client for Better Memory system.
 * 
 * Provides functions to interact with the memory backend:
 * - Retrieval: Query context packs
 * - Facts: CRUD operations
 * - Messages: Save and retrieve
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
  const response = await fetch(`${API_BASE}/api/memory/retrieval/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: params.text,
      k_facts: params.k_facts || 8,
      k_sem: params.k_sem || 6,
      token_budget: params.token_budget || 900,
      allow_vectors: params.allow_vectors || false,
      workspace_id: params.workspace_id || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Retrieval failed: ${response.status}`);
  }

  return response.json();
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

  const url = `${API_BASE}/api/memory/facts${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);

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
  const response = await fetch(`${API_BASE}/api/memory/facts/${id}`);

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
  const response = await fetch(`${API_BASE}/api/memory/facts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  const response = await fetch(`${API_BASE}/api/memory/facts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
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
  const response = await fetch(`${API_BASE}/api/memory/facts/${id}${params}`, {
    method: 'DELETE',
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
  const response = await fetch(`${API_BASE}/api/memory/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

  const url = `${API_BASE}/api/memory/messages${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);

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
  const response = await fetch(`${API_BASE}/api/memory/stats`);

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
  const response = await fetch(`${API_BASE}/api/memory/health`);

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
  const response = await fetch(`${API_BASE}/api/memory/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const response = await fetch(`${API_BASE}/api/memory/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
