/**
 * User Data Key Constants
 * 
 * Standardized key names for user data across the application.
 * This eliminates confusion from inconsistent naming (Issue 10).
 * 
 * USAGE:
 * - localStorage: Use STORAGE_KEYS
 * - Supabase preferences: Use PREFERENCE_KEYS
 * - Profile metadata: Use PROFILE_KEYS
 * - Facts table: Use FACT_KEYS
 */

// localStorage keys
export const STORAGE_KEYS = {
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  USER_EMAIL: 'user_email',
  HELP_CATEGORY: 'help_category',
  SELECTED_PLAN: 'selected_plan',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  SESSION_ID: 'session_id',
  USER_DATA: 'user_data',  // JSON blob of all onboarding data
};

// Supabase preferences table keys
export const PREFERENCE_KEYS = {
  USER_NAME: 'user_name',
  HELP_CATEGORY: 'help_category',
  SELECTED_PLAN: 'selected_plan',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PROMPT_PROFILE: 'prompt_profile',  // JSON string of profile
  PROMPT_CONTEXT: 'prompt_context',
};

// users.metadata.profile keys
export const PROFILE_KEYS = {
  NAME: 'name',
  HELP_CATEGORY: 'help_category',
  GOOGLE_OAUTH: 'google_oauth',
  SELECTED_PLAN: 'selected_plan',
  ONBOARDING_COMPLETED_AT: 'onboarding_completed_at',
  INTERACTION_COUNT: 'interaction_count',
};

// facts table category/predicate keys
export const FACT_KEYS = {
  PERSONAL: {
    CATEGORY: 'personal',
    NAME: 'name',
  },
  LOCATION: {
    CATEGORY: 'location',
    CITY: 'city',
  },
  EDUCATION: {
    CATEGORY: 'education',
    SCHOOL: 'school',
  },
  PREFERENCES: {
    CATEGORY: 'preferences',
    FAVORITE_FOOD: 'favorite_food',
    LIKES: 'likes',
  },
};

/**
 * Helper to get user name from localStorage
 */
export function getStoredUserName() {
  try {
    return localStorage.getItem(STORAGE_KEYS.USER_NAME) || null;
  } catch {
    return null;
  }
}

/**
 * Helper to get help category from localStorage
 */
export function getStoredHelpCategory() {
  try {
    return localStorage.getItem(STORAGE_KEYS.HELP_CATEGORY) || null;
  } catch {
    return null;
  }
}

/**
 * Helper to check if onboarding is completed
 */
export function isOnboardingCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';
  } catch {
    return false;
  }
}

/**
 * Helper to get user ID
 */
export function getStoredUserId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.USER_ID) || null;
  } catch {
    return null;
  }
}
