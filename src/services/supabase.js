/**
 * Supabase Client & Services
 * Unified database for cross-user caching, memory sync, and session management
 */

import { createClient } from '@supabase/supabase-js';
import { createLogger } from './logger.js';

const logger = createLogger('Supabase');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_ENABLED = Boolean(supabaseUrl && supabaseAnonKey);

if (!SUPABASE_ENABLED) {
  logger.warn('Supabase disabled: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

/**
 * Email/password sign-in, or create an account if it does not exist.
 * Returns the authenticated user or null when Supabase is disabled.
 */
export async function emailPasswordSignInOrCreate(email, password) {
  if (!SUPABASE_ENABLED || !supabase) return null;
  
  // First try to sign in
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn?.data?.user) {
    logger.info('Signed in existing user', { email });
    try { localStorage.setItem('user_id', signIn.data.user.id); } catch {}
    return signIn.data.user;
  }
  
  // If sign in failed (user doesn't exist or wrong password), try to sign up
  if (signIn?.error?.message?.includes('Invalid login credentials')) {
    logger.info('User not found, creating new account', { email });
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp?.error) {
      logger.error('Sign up failed', signUp.error);
      throw signUp.error;
    }
    const user = signUp?.data?.user || null;
    if (user) {
      try { localStorage.setItem('user_id', user.id); } catch {}
      logger.info('Created new user', { id: user.id, email });
    }
    return user;
  }
  
  // Other error (e.g., wrong password for existing user)
  if (signIn?.error) {
    logger.error('Sign in failed', signIn.error);
    throw signIn.error;
  }
  
  return null;
}

/**
 * Ensure a users row exists for the authenticated user. RLS requires auth.uid() = id.
 * Returns true if user row exists/was created, false otherwise.
 */
export async function ensureUsersRow(email) {
  if (!SUPABASE_ENABLED || !supabase) return false;
  const sess = await supabase.auth.getUser();
  const user = sess?.data?.user;
  if (!user) {
    logger.warn('ensureUsersRow: No authenticated user');
    return false;
  }
  
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    const gen = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    deviceId = gen();
    try { localStorage.setItem('device_id', deviceId); } catch {}
  }

  // First check if user row already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();
  
  if (existingUser) {
    // User exists, just update
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        email, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', user.id);
    
    if (updateError) {
      logger.error('ensureUsersRow update failed', updateError);
      return false;
    }
    logger.info('ensureUsersRow: User row updated', { id: user.id });
    return true;
  }
  
  // User doesn't exist, insert new row
  const { error: insertError } = await supabase
    .from('users')
    .insert({ 
      id: user.id, 
      device_id: deviceId, 
      email, 
      updated_at: new Date().toISOString() 
    });
  
  if (insertError) {
    // If device_id conflict, try without device_id
    if (insertError.code === '23505' && insertError.message?.includes('device_id')) {
      logger.warn('Device ID conflict, retrying without device_id');
      const { error: retryError } = await supabase
        .from('users')
        .insert({ 
          id: user.id, 
          email, 
          updated_at: new Date().toISOString() 
        });
      if (retryError) {
        logger.error('ensureUsersRow insert retry failed', retryError);
        return false;
      }
    } else {
      logger.error('ensureUsersRow insert failed', insertError);
      return false;
    }
  }
  
  logger.info('ensureUsersRow: User row created', { id: user.id });
  return true;
}

export const supabase = SUPABASE_ENABLED
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null;

logger.info('Supabase client initialized', { url: supabaseUrl, enabled: SUPABASE_ENABLED });

export const isLocalUserId = (userId) =>
  typeof userId === 'string' && userId.toLowerCase().startsWith('local-');

export const isSupabaseAvailable = () => SUPABASE_ENABLED && Boolean(supabase);

export const canUseSupabase = (userId = null) => {
  if (!isSupabaseAvailable()) return false;
  if (userId && isLocalUserId(userId)) return false;
  return true;
};

function fallbackUser(deviceId) {
  return {
    id: `local-${deviceId}`,
    device_id: deviceId,
    local_only: true,
    created_at: new Date().toISOString(),
  };
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get or create user by device ID
 */
export async function getOrCreateUser(deviceId) {
  try {
    if (!SUPABASE_ENABLED || !supabase) {
      logger.warn('Supabase disabled, returning fallback user');
      return fallbackUser(deviceId);
    }
    let normalizedId = deviceId;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(String(normalizedId))) {
      const gen = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
      normalizedId = gen();
      try { localStorage.setItem('device_id', normalizedId); } catch {}
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          device_id: normalizedId,
          consent_version: 1,
          scopes: {
            prompts: false,
            outputs: false,
            tools: false,
            screenshots: false,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' }
      )
      .select()
      .maybeSingle();

    if (error) {
      const msg = (error && (error.message || String(error))) || '';
      const code = error.code || '';
      if (code === '42501' || /row-level security/i.test(msg) || /unauthorized|401/i.test(msg)) {
        logger.warn('Supabase upsert blocked by RLS or unauthorized. Using fallback user.');
        return fallbackUser(normalizedId);
      }
      throw error;
    }

    if (data) {
      logger.debug('User ready', { userId: data.id });
      return data;
    }

    return fallbackUser(normalizedId);
  } catch (error) {
    logger.error('Failed to get/create user', error);
    // Graceful fallback on any network error in dev
    return fallbackUser(deviceId);
  }
}

/**
 * Update user consent scopes
 */
export async function updateConsent(userId, scopes) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return;
    const { error } = await supabase
      .from('users')
      .update({
        scopes,
        consented_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;

    logger.info('Consent updated', { userId, scopes });
  } catch (error) {
    logger.error('Failed to update consent', error);
    // Don't break UI on telemetry/consent failures
  }
}

// ============================================
// CROSS-USER CACHE (MAJOR INTEGRATION FIX)
// ============================================

/**
 * Check response cache (cross-user)
 * Returns cached response if available
 */
export async function checkResponseCache(prompt) {
  try {
    if (!SUPABASE_ENABLED || !supabase) return null;
    const normalized = prompt.toLowerCase().trim().replace(/[?!.,;]/g, '');

    const { data, error } = await supabase
      .from('response_cache')
      .select('*')
      .eq('prompt_normalized', normalized)
      .eq('is_personal', false)
      .limit(1);
    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (row) {
      // Update hit count
      await supabase
        .from('response_cache')
        .update({
          hit_count: row.hit_count + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      logger.info('🎯 Cache HIT (cross-user)', {
        prompt: prompt.substring(0, 50),
        hits: row.hit_count + 1,
      });

      return {
        response: row.response,
        cached: true,
        cacheType: 'supabase-cross-user',
        hitCount: row.hit_count + 1,
      };
    }

    logger.debug('Cache MISS', { prompt: prompt.substring(0, 50) });
    return null;
  } catch (error) {
    logger.error('Cache check failed', error);
    return null; // Fail gracefully
  }
}

/**
 * Store response in cache
 */
export async function storeResponseCache(prompt, response, isPersonal = false) {
  try {
    if (!SUPABASE_ENABLED || !supabase) return;
    const normalized = prompt.toLowerCase().trim().replace(/[?!.,;]/g, '');

    const { error } = await supabase.from('response_cache').upsert(
      {
        prompt_normalized: normalized,
        prompt_original: prompt,
        response,
        is_personal: isPersonal,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'prompt_normalized',
      }
    );

    if (error) throw error;

    logger.info('💾 Response cached', {
      prompt: prompt.substring(0, 50),
      isPersonal,
    });
  } catch (error) {
    logger.error('Failed to cache response', error);
    // Don't throw - caching failure shouldn't break the app
  }
}

// ============================================
// USER MEMORY (INTEGRATION FIX)
// ============================================

/**
 * Get user facts
 */
export async function getUserFacts(userId, category = null) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return [];
    let query = supabase.from('facts').select('*').eq('user_id', userId);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    logger.debug('Facts retrieved', { userId, count: data.length });
    return data;
  } catch (error) {
    logger.error('Failed to get facts', error);
    return [];
  }
}

/**
 * Set user fact
 */
export async function setUserFact(userId, category, key, value, source = 'user') {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return;
    const { error } = await supabase.from('facts').upsert(
      {
        user_id: userId,
        category,
        key,
        value,
        source,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,category,key',
      }
    );

    if (error) throw error;

    logger.info('Fact set', { userId, category, key });
  } catch (error) {
    logger.error('Failed to set fact', error);
    // Don't break UI
  }
}

/**
 * Get user preferences
 */
export async function getUserPreferences(userId) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return [];
    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    logger.debug('Preferences retrieved', { userId, count: data.length });
    return data;
  } catch (error) {
    logger.error('Failed to get preferences', error);
    return [];
  }
}

/**
 * Set user preference
 */
export async function setUserPreference(userId, key, value, category = 'general') {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return;
    const { error } = await supabase.from('preferences').upsert(
      {
        user_id: userId,
        key,
        value,
        category,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,key',
      }
    );

    if (error) throw error;

    logger.info('Preference set', { userId, key, category });
  } catch (error) {
    logger.error('Failed to set preference', error);
    // Don't break UI
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create new session
 */
export async function createSession(userId, title = null, mode = 'private') {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) {
      return {
        id: `local-session-${Date.now()}`,
        user_id: userId,
        title,
        mode,
        created_at: new Date().toISOString(),
      };
    }
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        title,
        mode,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Session created', { sessionId: data.id, mode });
    return data;
  } catch (error) {
    logger.error('Failed to create session', error);
    // Fallback session
    return {
      id: `local-session-${Date.now()}`,
      user_id: userId,
      title,
      mode,
      created_at: new Date().toISOString(),
    };
  }
}

/**
 * Get user sessions
 * @param {string} userId - User ID
 * @param {boolean} activeOnly - Only return active sessions
 * @param {boolean} includeMessages - Include messages for each session
 * @param {number} limit - Max number of sessions to return (default 100)
 */
export async function getUserSessions(userId, activeOnly = true, includeMessages = false, limit = 100) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return [];
    
    // Build select query - optionally include messages via join
    const selectQuery = includeMessages 
      ? '*, messages(id, role, content, created_at)' 
      : '*';
    
    let query = supabase
      .from('sessions')
      .select(selectQuery)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error} = await query;

    if (error) throw error;

    logger.debug('Sessions retrieved', { userId, count: data.length, limit });
    
    return data;
  } catch (error) {
    logger.error('Failed to get sessions', error);
    return [];
  }
}

/**
 * Store message in session
 */
export async function storeMessage(
  sessionId,
  role,
  content,
  redactedContent = null,
  metadata = {}
) {
  try {
    const isLocalSession = String(sessionId).startsWith('local-session-');
    if (!SUPABASE_ENABLED || !supabase || isLocalSession) {
      return;
    }
    const { error } = await supabase.from('messages').insert({
      session_id: sessionId,
      role,
      content,
      redacted_content: redactedContent || content,
      ...metadata,
    });

    if (error) throw error;

    logger.debug('Message stored', { sessionId, role });
  } catch (error) {
    logger.error('Failed to store message', error);
    // Don't throw - message storage failure shouldn't break chat
  }
}

// ============================================
// TELEMETRY
// ============================================

/**
 * Track telemetry event
 */
export async function trackEvent(userId, sessionId, eventType, action, metadata = {}) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return;
    const { error } = await supabase.from('telemetry_events').insert({
      user_id: userId,
      session_id: sessionId,
      event_type: eventType,
      action,
      metadata,
    });

    if (error) throw error;

    logger.debug('Event tracked', { eventType, action });
  } catch (error) {
    logger.error('Failed to track event', error);
    // Don't throw - telemetry failure shouldn't break the app
  }
}

// ============================================
// GDPR COMPLIANCE
// ============================================

/**
 * Purge all user data (GDPR)
 */
export async function purgeUserData(userId) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) return;
    const { error } = await supabase.rpc('purge_user_data', {
      target_user_id: userId,
    });

    if (error) throw error;

    logger.info('User data purged', { userId });
  } catch (error) {
    logger.error('Failed to purge user data', error);
    // Don't break UI
  }
}

export default {
  supabase,
  getOrCreateUser,
  updateConsent,
  checkResponseCache,
  storeResponseCache,
  getUserFacts,
  setUserFact,
  getUserPreferences,
  setUserPreference,
  createSession,
  getUserSessions,
  storeMessage,
  trackEvent,
  purgeUserData,
};
