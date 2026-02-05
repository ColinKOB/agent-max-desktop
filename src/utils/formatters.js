/**
 * Utility formatters for the application
 */

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2.5s", "1m 30s")
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '';
  
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format cost in dollars
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted cost (e.g., "$3.00")
 */
export function formatCost(amount) {
  if (!amount || amount < 0) return '$0.00';
  return `$${amount.toFixed(2)}`;
}

/**
 * Format date to relative time
 * @param {Date|string} date - Date to format
 * @returns {string} Relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) {
    return 'just now';
  }
  
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  }
  
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  
  if (diffDays === 1) {
    return 'yesterday';
  }
  
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  
  const months = Math.floor(diffDays / 30);
  if (months < 12) {
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Format file size in bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  
  return `${size} ${units[i]}`;
}

/**
 * Format percentage
 * @param {number} value - Value between 0 and 1 or 0 and 100
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage (e.g., "75.5%")
 */
export function formatPercentage(value, decimals = 1) {
  if (!value || value < 0) return '0%';
  
  // If value is between 0 and 1, multiply by 100
  const percentage = value <= 1 ? value * 100 : value;
  
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: "...")
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number (e.g., "1,234,567")
 */
export function formatNumber(num) {
  if (!num && num !== 0) return '0';
  
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Pluralize word based on count
 * @param {number} count - Count
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (optional, adds 's' by default)
 * @returns {string} Pluralized word
 */
export function pluralize(count, singular, plural) {
  if (count === 1) return singular;
  
  return plural || `${singular}s`;
}

/**
 * Format conversation count with context
 * @param {number} count - Number of conversations
 * @param {number} limit - Limit (optional)
 * @returns {string} Formatted count (e.g., "5/50 conversations")
 */
export function formatConversationCount(count, limit) {
  const conversationText = pluralize(count, 'conversation');
  
  if (limit) {
    return `${count}/${limit} ${conversationText}`;
  }
  
  return `${count} ${conversationText}`;
}

/**
 * Format API status
 * @param {boolean} connected - Connection status
 * @param {number} latency - Latency in ms (optional)
 * @returns {string} Status text
 */
export function formatApiStatus(connected, latency) {
  if (!connected) {
    return 'Disconnected';
  }

  if (latency) {
    if (latency < 100) return 'Connected (Excellent)';
    if (latency < 300) return 'Connected (Good)';
    if (latency < 1000) return 'Connected (Fair)';
    return 'Connected (Poor)';
  }

  return 'Connected';
}

/**
 * Strip internal JSON action blocks from content before displaying to user.
 * These blocks like {"action": "workspace.search", "args": {...}} are used internally
 * for executing macOS native tools but should not be shown in the UI.
 * @param {string} content - Content that may contain action blocks
 * @returns {string} Content with action blocks removed
 */
export function stripActionBlocks(content) {
  // Extra safety: return empty string for any non-string input
  if (content === null || content === undefined) return '';
  if (typeof content !== 'string') return String(content);

  try {
    // Pattern to match JSON action blocks: {"action": "...", "args": {...}}
    // This handles various formats including nested objects and whitespace
    // Replace with a single space to avoid merging adjacent words
    const actionBlockPattern = /\s*\{"action":\s*"[^"]+"\s*(?:,\s*"args":\s*\{[^}]*\})?\s*\}\s*/g;

    // Also strip any "Action requested: ..." lines that precede the JSON
    const actionRequestedPattern = /\s*Action requested:\s*[^\n]+\s*/gi;

    let cleaned = content
      .replace(actionBlockPattern, ' ')
      .replace(actionRequestedPattern, ' ')
      .replace(/[^\S\n]+/g, ' ') // Normalize multiple spaces to single space (preserve newlines for markdown)
      .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines to 2 (standard markdown paragraph break)
      .trim();

    return cleaned;
  } catch (e) {
    console.error('[stripActionBlocks] Error:', e);
    return content; // Return original content if anything fails
  }
}
