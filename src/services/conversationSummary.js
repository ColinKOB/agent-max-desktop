/**
 * Conversation Summary Service
 * Generates 5-word summaries of conversations using GPT-5-mini
 */

const API_BASE_URL = 'http://localhost:8000';

/**
 * Generate a 5-word summary of a conversation
 * @param {Array} thoughts - Array of conversation messages/thoughts
 * @returns {Promise<string>} - 5-word summary
 */
export async function generateConversationSummary(thoughts) {
  try {
    // If no thoughts, return default
    if (!thoughts || thoughts.length === 0) {
      return 'Empty conversation';
    }

    // Build conversation text from thoughts
    const conversationText = thoughts
      .map(t => typeof t === 'string' ? t : t.text || t.message || '')
      .filter(t => t.length > 0)
      .join('\n');

    // If conversation is too short, create a simple summary
    if (conversationText.length < 10) {
      return 'Brief conversation';
    }

    // Call backend to generate summary
    const response = await fetch(`${API_BASE_URL}/api/v2/conversation/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation: conversationText,
        max_words: 5
      }),
    });

    if (!response.ok) {
      console.error('[Summary] API error:', response.status);
      return generateFallbackSummary(conversationText);
    }

    const data = await response.json();
    return data.summary || generateFallbackSummary(conversationText);

  } catch (error) {
    console.error('[Summary] Error generating summary:', error);
    return generateFallbackSummary(thoughts);
  }
}

/**
 * Generate a fallback summary when API fails
 * @param {string|Array} content - Conversation content
 * @returns {string} - Simple 5-word summary
 */
function generateFallbackSummary(content) {
  const text = Array.isArray(content) 
    ? content.map(t => typeof t === 'string' ? t : t.text || t.message || '').join(' ')
    : String(content);

  // Extract meaningful words (skip common words)
  const skipWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can']);
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !skipWords.has(w))
    .slice(0, 5);

  if (words.length >= 3) {
    // Capitalize first letter
    const summary = words.slice(0, 5).join(' ');
    return summary.charAt(0).toUpperCase() + summary.slice(1);
  }

  // Ultimate fallback - use timestamp
  const timestamp = new Date().toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  return `Chat ${timestamp}`;
}

export default {
  generateConversationSummary
};
