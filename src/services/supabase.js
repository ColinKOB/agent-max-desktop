/**
 * Supabase Client & Services
 * Unified database for cross-user caching, memory sync, and session management
 */

import { createClient } from '@supabase/supabase-js';
import { createLogger } from './logger.js';

const logger = createLogger('Supabase');

// Production Supabase configuration
// These are the PUBLIC anon key and URL - safe to include in client code
// The anon key only has access to RLS-protected data
const PRODUCTION_SUPABASE_URL = 'https://rburoajxsyfousnleydw.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidXJvYWp4c3lmb3VzbmxleWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTE2MTgsImV4cCI6MjA3NjU2NzYxOH0.sWHCQpHiQvI_whjLKF8ybR3mr9BNtPF68MgKT1LLuSc';

// Use env vars if available, otherwise fall back to production defaults
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PRODUCTION_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || PRODUCTION_SUPABASE_ANON_KEY;
export const SUPABASE_ENABLED = Boolean(supabaseUrl && supabaseAnonKey);

if (!import.meta.env.VITE_SUPABASE_URL) {
  logger.info('Using production Supabase defaults (env vars not set)');
}

/**
 * Send password reset email via Supabase Auth.
 * User will receive an email with a link to reset their password.
 *
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resetPassword(email) {
  if (!SUPABASE_ENABLED || !supabase) {
    return { success: false, error: 'Authentication service unavailable' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Supabase will redirect here after user clicks reset link
      // For desktop app, this goes to Supabase's hosted reset page
      redirectTo: `${window.location.origin}/#/reset-password`,
    });

    if (error) {
      logger.error('Password reset failed', error);
      return { success: false, error: error.message };
    }

    logger.info('Password reset email sent', { email });
    return { success: true };
  } catch (err) {
    logger.error('Password reset error', err);
    return { success: false, error: err.message || 'Failed to send reset email' };
  }
}

/**
 * Email/password sign-in, or create an account if it does not exist.
 * Returns the authenticated user or null when Supabase is disabled.
 *
 * IMPORTANT: This function also checks if the user has an existing subscription
 * and links the current device to that account to prevent duplicate subscriptions.
 */
export async function emailPasswordSignInOrCreate(email, password) {
  if (!SUPABASE_ENABLED || !supabase) return null;

  // First try to sign in
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn?.data?.user) {
    logger.info('Signed in existing user', { email });
    const authUserId = signIn.data.user.id;
    try { localStorage.setItem('user_id', authUserId); } catch {}

    // CRITICAL: Check if this email has an existing subscription in the users table
    // If so, we should use THAT user_id to ensure subscription continuity
    let finalUserId = authUserId;
    try {
      const existingUser = await supabase
        .from('users')
        .select('id, email, subscription_status, subscription_tier, credits')
        .eq('email', email)
        .single();

      if (existingUser?.data && existingUser.data.subscription_status === 'active') {
        // User has an existing subscription - use that user_id
        const existingUserId = existingUser.data.id;
        logger.info('Found existing subscription for email', {
          email,
          existingUserId,
          tier: existingUser.data.subscription_tier,
          credits: existingUser.data.credits
        });

        // Update localStorage to use the existing user_id
        try { localStorage.setItem('user_id', existingUserId); } catch {}
        finalUserId = existingUserId;

        // Check for weekly credit reset (backup for pg_cron)
        // This runs asynchronously to not block login
        checkAndResetWeeklyCredits(existingUserId).catch(err => {
          logger.warn('Weekly credit reset check failed (non-blocking)', err);
        });

        // Return the auth user but with the existing subscription user_id
        return { ...signIn.data.user, id: existingUserId, _authId: authUserId };
      }
    } catch (lookupErr) {
      logger.warn('Failed to lookup existing subscription', lookupErr);
    }

    // Still check for weekly reset even if no active subscription found
    // (in case subscription was just activated)
    checkAndResetWeeklyCredits(finalUserId).catch(err => {
      logger.warn('Weekly credit reset check failed (non-blocking)', err);
    });

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
      auth: {
        persistSession: true,
        storageKey: 'amx-supabase-auth',
        autoRefreshToken: true,
        detectSessionInUrl: false, // Electron doesn't use URL for session
      },
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
// WEEKLY CREDIT RESET CHECK (BACKUP FOR PG_CRON)
// ============================================

/**
 * Check if user's weekly credit reset is due and perform it if needed.
 * This is a BACKUP mechanism for the pg_cron scheduled reset.
 * Call this on user login/session start.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Reset result
 */
export async function checkAndResetWeeklyCredits(userId) {
  try {
    if (!SUPABASE_ENABLED || !supabase || String(userId).startsWith('local-')) {
      return { reset_performed: false, reason: 'Supabase not available or local user' };
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';

    const response = await fetch(`${apiUrl}/api/v2/credits/check-weekly-reset/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('Weekly credit reset check failed', { status: response.status, error: errorText });
      return { reset_performed: false, reason: `API error: ${response.status}` };
    }

    const result = await response.json();

    if (result.reset_performed) {
      logger.info('Weekly credit reset performed!', {
        previous: result.previous_credits,
        new: result.credits,
        tier: result.subscription_tier
      });
    } else {
      logger.debug('Weekly credit reset not needed', { reason: result.reason });
    }

    return result;
  } catch (error) {
    logger.error('Failed to check weekly credit reset', error);
    return { reset_performed: false, reason: error.message };
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
  checkAndResetWeeklyCredits,
};
