/**
 * Feature Gates Configuration
 *
 * Controls access to features that are in development or limited release.
 */

// Users with full access to Google integration (beta testers)
const GOOGLE_BETA_USERS = [
  'colinkobrien1@gmail.com',
];

/**
 * Check if a user has access to Google integration features
 * @param {string} userEmail - The user's email address
 * @returns {boolean} - Whether the user can access Google features
 */
export function canAccessGoogleFeatures(userEmail) {
  if (!userEmail) return false;
  return GOOGLE_BETA_USERS.includes(userEmail.toLowerCase());
}

/**
 * Check if Google features should show as "Coming Soon"
 * @param {string} userEmail - The user's email address
 * @returns {boolean} - Whether to show "Coming Soon" instead of the feature
 */
export function isGoogleComingSoon(userEmail) {
  return !canAccessGoogleFeatures(userEmail);
}

export default {
  canAccessGoogleFeatures,
  isGoogleComingSoon,
  GOOGLE_BETA_USERS,
};
