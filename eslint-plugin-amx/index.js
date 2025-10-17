/**
 * ESLint Plugin: amx
 * 
 * Custom ESLint rules for Agent Max design system enforcement.
 * Prevents common mistakes and enforces glass UI consistency.
 */

module.exports = {
  rules: {
    'no-opaque-in-glass': require('./lib/rules/no-opaque-in-glass'),
  },
  configs: {
    recommended: {
      plugins: ['amx'],
      rules: {
        'amx/no-opaque-in-glass': 'error',
      },
    },
  },
};
