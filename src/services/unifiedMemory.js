/**
 * Unified Memory Service (Phase 3)
 * 
 * Single source of truth: Backend memory API (Postgres on Railway)
 * - Primary: Backend /api/v2/memory/* endpoints
 * - Mirror: Supabase (async sync for redundancy)
 * - Offline: Electron local queue with auto-sync when online
 * 
 * This replaces the split Supabase-first approach with backend-first.
 */

import memoryAPI from './memoryAPI.js';
import { supabase, storeMessage as supabaseStoreMessage } from './supabase.js';
import { createLogger } from './logger.js';

const logger = createLogger('UnifiedMemory');

// Offline queue for when backend is unreachable
let offlineQueue = [];
let isOnline = navigator.onLine;
let syncInProgress = false;

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  logger.info('Connection restored, syncing queued operations');
  processOfflineQueue();
});

window.addEventListener('offline', () => {
  isOnline = false;
  logger.warn('Connection lost, queueing operations');
});

/**
 * Process queued operations when back online
 */
async function processOfflineQueue() {
  if (syncInProgress || offlineQueue.length === 0 || !isOnline) {
    return;
  }

  syncInProgress = true;
  logger.info(`Processing ${offlineQueue.length} queued operations`);

  const operations = [...offlineQueue];
  offlineQueue = [];

  for (const operation of operations) {
    try {
      await executeOperation(operation);
      logger.debug('Synced operation:', operation.type);
    } catch (error) {
      logger.error('Failed to sync operation, re-queuing:', error);
      offlineQueue.push(operation);
    }
  }

  syncInProgress = false;

  // Retry failed operations after delay
  if (offlineQueue.length > 0) {
    setTimeout(processOfflineQueue, 10000);
  }
}

/**
 * Execute an operation (backend-first, with Supabase mirror)
 */
async function executeOperation(operation) {
  const { type, data } = operation;

  try {
    switch (type) {
      case 'save_message':
        await memoryAPI.saveMessage(data);
        // Mirror to Supabase asynchronously (don't block on failure)
        mirrorToSupabase('message', data).catch(err => 
          logger.debug('Supabase mirror failed (non-critical):', err)
        );
        break;

      case 'create_fact':
        await memoryAPI.createFact(data);
        mirrorToSupabase('fact', data).catch(err => 
          logger.debug('Supabase mirror failed (non-critical):', err)
        );
        break;

      case 'update_fact':
        await memoryAPI.updateFact(data.id, data.updates);
        break;

      case 'delete_fact':
        await memoryAPI.deleteFact(data.id, data.hardDelete);
        break;

      default:
        logger.warn('Unknown operation type:', type);
    }
  } catch (error) {
    logger.error(`Operation ${type} failed:`, error);
    throw error;
  }
}

/**
 * Mirror data to Supabase (async, non-blocking)
 */
async function mirrorToSupabase(dataType, data) {
  if (!supabase) {
    return; // Supabase not configured
  }

  try {
    if (dataType === 'message') {
      await supabaseStoreMessage(data);
    }
    // Add other data types as needed
  } catch (error) {
    // Supabase mirror failures are non-critical
    logger.debug('Supabase mirror error:', error);
  }
}

/**
 * Save a conversation message
 * @param {Object} messageData - Message data
 * @param {string} messageData.role - Message role (user, assistant, system)
 * @param {string} messageData.content - Message content
 * @param {string} [messageData.session_id] - Session UUID
 * @returns {Promise<Object>} Saved message
 */
export async function saveMessage(messageData) {
  const operation = {
    type: 'save_message',
    data: messageData,
    timestamp: new Date().toISOString()
  };

  if (isOnline) {
    try {
      return await executeOperation(operation);
    } catch (error) {
      logger.warn('Backend unavailable, queueing message');
      offlineQueue.push(operation);
      // Store locally via Electron if available
      if (window.electron?.memory?.addMessage) {
        return await window.electron.memory.addMessage(messageData);
      }
      throw error;
    }
  } else {
    offlineQueue.push(operation);
    // Store locally via Electron if available
    if (window.electron?.memory?.addMessage) {
      return await window.electron.memory.addMessage(messageData);
    }
    throw new Error('Offline and no local storage available');
  }
}

/**
 * Get recent messages
 * @param {Object} [options={}] - Options
 * @param {number} [options.limit=10] - Number of messages
 * @param {string} [options.session_id] - Filter by session
 * @returns {Promise<Array>} Array of messages
 */
export async function getMessages(options = {}) {
  try {
    return await memoryAPI.getMessages(options);
  } catch (error) {
    logger.error('Failed to get messages:', error);
    // Fallback to local if available
    if (window.electron?.memory?.getMessages) {
      return await window.electron.memory.getMessages(options);
    }
    throw error;
  }
}

/**
 * Query memory retrieval
 * @param {Object} params - Retrieval parameters
 * @param {string} params.text - Query text
 * @param {number} [params.k_facts=8] - Number of facts
 * @param {number} [params.k_sem=6] - Number of semantic hits
 * @param {number} [params.token_budget=900] - Token budget
 * @param {boolean} [params.allow_vectors=true] - Use vector search (default true)
 * @returns {Promise<Object>} Retrieval pack
 */
export async function queryRetrieval(params) {
  try {
    return await memoryAPI.query(params);
  } catch (error) {
    logger.error('Failed to query retrieval:', error);
    throw error;
  }
}

/**
 * Create a new fact
 * @param {Object} factData - Fact data
 * @returns {Promise<Object>} Created fact
 */
export async function createFact(factData) {
  const operation = {
    type: 'create_fact',
    data: factData,
    timestamp: new Date().toISOString()
  };

  if (isOnline) {
    try {
      return await executeOperation(operation);
    } catch (error) {
      logger.warn('Backend unavailable, queueing fact');
      offlineQueue.push(operation);
      throw error;
    }
  } else {
    offlineQueue.push(operation);
    throw new Error('Offline - fact will sync when online');
  }
}

/**
 * Update an existing fact
 * @param {string} id - Fact UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated fact
 */
export async function updateFact(id, updates) {
  const operation = {
    type: 'update_fact',
    data: { id, updates },
    timestamp: new Date().toISOString()
  };

  if (isOnline) {
    try {
      return await executeOperation(operation);
    } catch (error) {
      logger.warn('Backend unavailable, queueing update');
      offlineQueue.push(operation);
      throw error;
    }
  } else {
    offlineQueue.push(operation);
    throw new Error('Offline - update will sync when online');
  }
}

/**
 * Delete a fact
 * @param {string} id - Fact UUID
 * @param {boolean} [hardDelete=false] - Permanently delete vs tombstone
 * @returns {Promise<void>}
 */
export async function deleteFact(id, hardDelete = false) {
  const operation = {
    type: 'delete_fact',
    data: { id, hardDelete },
    timestamp: new Date().toISOString()
  };

  if (isOnline) {
    try {
      return await executeOperation(operation);
    } catch (error) {
      logger.warn('Backend unavailable, queueing delete');
      offlineQueue.push(operation);
      throw error;
    }
  } else {
    offlineQueue.push(operation);
    throw new Error('Offline - delete will sync when online');
  }
}

/**
 * Get all facts
 * @param {Object} [filters={}] - Filter options
 * @returns {Promise<Array>} Array of facts
 */
export async function getFacts(filters = {}) {
  try {
    return await memoryAPI.getFacts(filters);
  } catch (error) {
    logger.error('Failed to get facts:', error);
    throw error;
  }
}

/**
 * Extract facts from a message
 * @param {Object} payload - Extraction payload
 * @param {string} payload.message - Message to extract from
 * @param {string} [payload.source_msg_id] - Source message ID
 * @returns {Promise<Array>} Array of extraction proposals
 */
export async function extractFacts(payload) {
  try {
    return await memoryAPI.extract(payload);
  } catch (error) {
    logger.error('Failed to extract facts:', error);
    throw error;
  }
}

/**
 * Apply confirmed extraction proposals
 * @param {Object} payload - Apply payload
 * @param {Array} payload.proposals - Proposals to apply
 * @param {Array<string>} payload.confirmed - IDs of confirmed proposals
 * @returns {Promise<Object>} Apply result summary
 */
export async function applyProposals(payload) {
  try {
    return await memoryAPI.apply(payload);
  } catch (error) {
    logger.error('Failed to apply proposals:', error);
    throw error;
  }
}

/**
 * Get memory statistics
 * @returns {Promise<Object>} Stats object
 */
export async function getStats() {
  try {
    return await memoryAPI.getStats();
  } catch (error) {
    logger.error('Failed to get stats:', error);
    throw error;
  }
}

/**
 * Check memory system health
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  try {
    return await memoryAPI.checkHealth();
  } catch (error) {
    logger.error('Health check failed:', error);
    throw error;
  }
}

/**
 * Get offline queue status (for debugging/UI)
 * @returns {Object} Queue status
 */
export function getQueueStatus() {
  return {
    queueLength: offlineQueue.length,
    isOnline,
    syncInProgress
  };
}

// Export all functions as default object
const unifiedMemory = {
  saveMessage,
  getMessages,
  queryRetrieval,
  createFact,
  updateFact,
  deleteFact,
  getFacts,
  extractFacts,
  applyProposals,
  getStats,
  checkHealth,
  getQueueStatus
};

export default unifiedMemory;
