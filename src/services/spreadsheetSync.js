/**
 * Spreadsheet Sync Service
 *
 * Handles cloud synchronization of spreadsheets with Supabase.
 * Provides save, load, list, and delete operations for user spreadsheets.
 */

import { createClient } from '@supabase/supabase-js';

// Supabase client will be initialized with user's credentials
let supabaseClient = null;

/**
 * Initialize Supabase client
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} supabaseKey - Supabase anon/service key
 */
export function initSupabase(supabaseUrl, supabaseKey) {
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    return true;
  }
  return false;
}

/**
 * Set existing Supabase client
 * @param {object} client - Supabase client instance
 */
export function setSupabaseClient(client) {
  supabaseClient = client;
}

/**
 * Get the Supabase client
 */
export function getSupabaseClient() {
  return supabaseClient;
}

/**
 * Save a spreadsheet to Supabase
 * @param {string} userId - User ID
 * @param {string} name - Spreadsheet name
 * @param {object[]} data - FortuneSheet data
 * @param {string} spreadsheetId - Optional existing spreadsheet ID for update
 * @returns {Promise<{success: boolean, spreadsheet?: object, error?: string}>}
 */
export async function saveToCloud(userId, name, data, spreadsheetId = null) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const spreadsheetData = {
      user_id: userId,
      name: name,
      data: data,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (spreadsheetId) {
      // Update existing spreadsheet
      const { data: updatedData, error } = await supabaseClient
        .from('spreadsheets')
        .update(spreadsheetData)
        .eq('id', spreadsheetId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      result = updatedData;
    } else {
      // Insert new spreadsheet
      spreadsheetData.created_at = new Date().toISOString();

      const { data: insertedData, error } = await supabaseClient
        .from('spreadsheets')
        .insert(spreadsheetData)
        .select()
        .single();

      if (error) throw error;
      result = insertedData;
    }

    return {
      success: true,
      spreadsheet: result,
    };
  } catch (error) {
    console.error('[SpreadsheetSync] Save error:', error);
    return {
      success: false,
      error: error.message || 'Failed to save to cloud',
    };
  }
}

/**
 * Load a spreadsheet from Supabase
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} userId - Optional user ID for verification
 * @returns {Promise<{success: boolean, spreadsheet?: object, error?: string}>}
 */
export async function loadFromCloud(spreadsheetId, userId = null) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    let query = supabaseClient
      .from('spreadsheets')
      .select('*')
      .eq('id', spreadsheetId)
      .eq('is_deleted', false)
      .single();

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) {
      return { success: false, error: 'Spreadsheet not found' };
    }

    return {
      success: true,
      spreadsheet: data,
    };
  } catch (error) {
    console.error('[SpreadsheetSync] Load error:', error);
    return {
      success: false,
      error: error.message || 'Failed to load from cloud',
    };
  }
}

/**
 * List all spreadsheets for a user
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @param {number} options.limit - Max results (default 50)
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.orderBy - Order by column (default 'updated_at')
 * @param {boolean} options.ascending - Sort direction (default false)
 * @returns {Promise<{success: boolean, spreadsheets?: object[], count?: number, error?: string}>}
 */
export async function listUserSpreadsheets(userId, options = {}) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  const {
    limit = 50,
    offset = 0,
    orderBy = 'updated_at',
    ascending = false,
  } = options;

  try {
    // Get count first
    const { count, error: countError } = await supabaseClient
      .from('spreadsheets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false);

    if (countError) throw countError;

    // Get actual data
    const { data, error } = await supabaseClient
      .from('spreadsheets')
      .select('id, name, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      success: true,
      spreadsheets: data || [],
      count: count || 0,
    };
  } catch (error) {
    console.error('[SpreadsheetSync] List error:', error);
    return {
      success: false,
      error: error.message || 'Failed to list spreadsheets',
    };
  }
}

/**
 * Delete a spreadsheet (soft delete)
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} userId - User ID for verification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteFromCloud(spreadsheetId, userId) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabaseClient
      .from('spreadsheets')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', spreadsheetId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('[SpreadsheetSync] Delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete spreadsheet',
    };
  }
}

/**
 * Permanently delete a spreadsheet (hard delete)
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} userId - User ID for verification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function permanentlyDelete(spreadsheetId, userId) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabaseClient
      .from('spreadsheets')
      .delete()
      .eq('id', spreadsheetId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('[SpreadsheetSync] Permanent delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to permanently delete spreadsheet',
    };
  }
}

/**
 * Rename a spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} userId - User ID
 * @param {string} newName - New name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function renameSpreadsheet(spreadsheetId, userId, newName) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabaseClient
      .from('spreadsheets')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', spreadsheetId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('[SpreadsheetSync] Rename error:', error);
    return {
      success: false,
      error: error.message || 'Failed to rename spreadsheet',
    };
  }
}

/**
 * Duplicate a spreadsheet
 * @param {string} spreadsheetId - Source spreadsheet ID
 * @param {string} userId - User ID
 * @param {string} newName - Name for the copy
 * @returns {Promise<{success: boolean, spreadsheet?: object, error?: string}>}
 */
export async function duplicateSpreadsheet(spreadsheetId, userId, newName) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    // Load the original
    const loadResult = await loadFromCloud(spreadsheetId, userId);
    if (!loadResult.success) {
      return loadResult;
    }

    // Save as new
    return await saveToCloud(userId, newName, loadResult.spreadsheet.data);
  } catch (error) {
    console.error('[SpreadsheetSync] Duplicate error:', error);
    return {
      success: false,
      error: error.message || 'Failed to duplicate spreadsheet',
    };
  }
}

/**
 * Search spreadsheets by name
 * @param {string} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {Promise<{success: boolean, spreadsheets?: object[], error?: string}>}
 */
export async function searchSpreadsheets(userId, searchTerm) {
  if (!supabaseClient) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { data, error } = await supabaseClient
      .from('spreadsheets')
      .select('id, name, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .ilike('name', `%${searchTerm}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return {
      success: true,
      spreadsheets: data || [],
    };
  } catch (error) {
    console.error('[SpreadsheetSync] Search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to search spreadsheets',
    };
  }
}

/**
 * Check sync status (connectivity and quota)
 * @returns {Promise<{success: boolean, connected: boolean, error?: string}>}
 */
export async function checkSyncStatus() {
  if (!supabaseClient) {
    return { success: true, connected: false };
  }

  try {
    // Simple health check
    const { error } = await supabaseClient.from('spreadsheets').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      throw error;
    }

    return { success: true, connected: true };
  } catch (error) {
    console.error('[SpreadsheetSync] Status check error:', error);
    return {
      success: false,
      connected: false,
      error: error.message,
    };
  }
}

export default {
  initSupabase,
  setSupabaseClient,
  getSupabaseClient,
  saveToCloud,
  loadFromCloud,
  listUserSpreadsheets,
  deleteFromCloud,
  permanentlyDelete,
  renameSpreadsheet,
  duplicateSpreadsheet,
  searchSpreadsheets,
  checkSyncStatus,
};
