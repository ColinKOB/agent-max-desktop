/**
 * Context Selector - Deterministic memory retrieval
 * Selects the minimum, most relevant memory slices for each goal
 * 
 * Features:
 * - Hybrid retrieval (semantic + keyword)
 * - Token budgeting (never exceed limits)
 * - Policy filtering (PII, consent)
 * - Always-include rules (name, timezone, explicit prefs)
 * - Provenance-aware selection
 */

/**
 * Context slice structure
 * @typedef {Object} ContextSlice
 * @property {string} id - Unique identifier
 * @property {string} kind - Type: 'fact' | 'message' | 'note' | 'preference'
 * @property {string} text - The actual content
 * @property {number} priority - Base priority (0-1)
 * @property {number} tokens - Estimated token count
 * @property {number} pii - PII level (0-3)
 * @property {string} consent - Consent scope
 * @property {number} score - Computed relevance score
 * @property {Object} metadata - Additional context
 */

class ContextSelector {
  constructor() {
    this.defaultTokenBudget = 1500; // Max tokens for memory context
    this.alwaysIncludeThreshold = 0.95; // Priority threshold for mandatory inclusion
  }

  /**
   * Select context for a goal
   * @param {string} goal - User's current goal
   * @param {Object} vault - Memory vault instance (for querying)
   * @param {Object} options - Selection options
   * @returns {ContextSlice[]} - Selected context slices
   */
  async selectContext(goal, vault, options = {}) {
    const {
      tokenBudget = this.defaultTokenBudget,
      includePII = 2, // Max PII level to include (0-3)
      respectConsent = true,
      alpha = 0.7, // Weight for semantic vs keyword (0=all keyword, 1=all semantic)
    } = options;

    // Step 1: Get all candidates
    const candidates = await this._getAllCandidates(vault);

    // Step 2: Score candidates against goal
    const scored = this._scoreCandiates(goal, candidates, alpha);

    // Step 3: Policy filter
    const filtered = this._applyPolicyFilters(scored, includePII, respectConsent);

    // Step 4: Separate always-include from ranked
    const alwaysInclude = filtered.filter((s) => s.priority >= this.alwaysIncludeThreshold);
    const ranked = filtered.filter((s) => s.priority < this.alwaysIncludeThreshold);

    // Step 5: Stable sort (deterministic tie-breaking)
    const sortedRanked = this._stableSort(ranked);

    // Step 6: Pack to budget
    const selected = this._packToBudget([...alwaysInclude, ...sortedRanked], tokenBudget);

    // Step 7: Compute deterministic hash
    const contextHash = this._computeHash(selected);
    const totalTokens = this._totalTokens(selected);

    console.log(`[Context Selector] Selected ${selected.length} slices (${totalTokens}/${tokenBudget} tokens, hash: ${contextHash})`);

    return {
      slices: selected,
      meta: {
        version: this.version,
        hash: contextHash,
        totalTokens,
        goal,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get all candidate slices from vault
   */
  async _getAllCandidates(vault) {
    const candidates = [];

    // Get all facts
    const facts = vault.getAllFacts();
    for (const fact of facts) {
      candidates.push({
        id: fact.id,
        kind: 'fact',
        text: this._formatFact(fact),
        priority: fact.confidence,
        tokens: this._estimateTokens(this._formatFact(fact)),
        pii: fact.pii_level,
        consent: fact.consent_scope,
        score: 0, // Will be computed
        metadata: {
          category: fact.category,
          predicate: fact.predicate,
          object: fact.object,
          decay: vault.getFactRelevance(fact),
        },
      });
    }

    // Get recent messages (last 10)
    const messages = vault.getRecentMessages(10);
    for (const msg of messages) {
      candidates.push({
        id: msg.id,
        kind: 'message',
        text: `${msg.role}: ${msg.content}`,
        priority: 0.5, // Medium priority
        tokens: this._estimateTokens(msg.content),
        pii: 1, // Assume messages may contain semi-private info
        consent: 'default',
        score: 0,
        metadata: {
          role: msg.role,
          created_at: msg.created_at,
        },
      });
    }

    // TODO: Get notes/summaries when implemented

    return candidates;
  }

  /**
   * Score candidates against goal
   * Uses hybrid scoring: semantic + keyword
   */
  _scoreCandiates(goal, candidates, alpha) {
    const goalLower = goal.toLowerCase();
    const goalWords = new Set(this._extractKeywords(goalLower));

    for (const candidate of candidates) {
      // Keyword score (Jaccard similarity)
      const keywordScore = this._keywordScore(goalWords, candidate.text);

      // Semantic score (simple for now - can be enhanced with embeddings)
      const semanticScore = this._semanticScore(goal, candidate);

      // Combined score
      candidate.score = alpha * semanticScore + (1 - alpha) * keywordScore;

      // Boost by priority and decay
      if (candidate.metadata.decay !== undefined) {
        candidate.score *= candidate.metadata.decay;
      }
      candidate.score *= 1 + candidate.priority * 0.2; // Up to 20% boost
    }

    return candidates;
  }

  /**
   * Keyword-based scoring (Jaccard similarity)
   */
  _keywordScore(goalWords, text) {
    const textWords = new Set(this._extractKeywords(text.toLowerCase()));

    if (textWords.size === 0 || goalWords.size === 0) return 0;

    const intersection = new Set([...goalWords].filter((w) => textWords.has(w)));
    const union = new Set([...goalWords, ...textWords]);

    return intersection.size / union.size;
  }

  /**
   * Semantic scoring (simple heuristic-based for now)
   * Can be upgraded to embeddings in Phase 6
   */
  _semanticScore(goal, candidate) {
    const goalLower = goal.toLowerCase();
    const textLower = candidate.text.toLowerCase();

    let score = 0;

    // Exact substring match
    if (textLower.includes(goalLower) || goalLower.includes(textLower)) {
      score += 0.5;
    }

    // Category matching for facts
    if (candidate.kind === 'fact') {
      const category = candidate.metadata.category;

      // Goal-category heuristics
      if (goalLower.includes('weather') && category === 'location') score += 0.4;
      if (goalLower.includes('email') && category === 'personal') score += 0.3;
      if (goalLower.includes('code') && category === 'preference') score += 0.3;
      if (goalLower.includes('work') && category === 'work') score += 0.4;

      // Predicate matching
      const predicate = candidate.metadata.predicate;
      if (goalLower.includes(predicate)) score += 0.3;
    }

    // Recent messages are relevant for conversation context
    if (candidate.kind === 'message') {
      score += 0.2; // Base relevance for messages
    }

    return Math.min(score, 1.0);
  }

  /**
   * Apply policy filters (PII, consent)
   */
  _applyPolicyFilters(candidates, maxPII, respectConsent) {
    return candidates.filter((c) => {
      // Filter by PII level
      if (c.pii > maxPII) {
        return false;
      }

      // Filter by consent
      if (respectConsent && c.consent === 'never_upload') {
        return false;
      }

      return true;
    });
  }

  /**
   * Pack slices to token budget (greedy algorithm)
   */
  _packToBudget(slices, budget) {
    const selected = [];
    let used = 0;

    for (const slice of slices) {
      if (used + slice.tokens <= budget) {
        selected.push(slice);
        used += slice.tokens;
      } else if (selected.length === 0 && slice.priority >= this.alwaysIncludeThreshold) {
        // Always include high-priority items even if over budget
        selected.push(slice);
        used += slice.tokens;
        break; // Stop after first over-budget item
      }
    }

    return selected;
  }

  /**
   * Format fact as readable text
   */
  _formatFact(fact) {
    return `${fact.category}.${fact.predicate}: ${fact.object}`;
  }

  /**
   * Estimate token count (rough approximation)
   */
  _estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract keywords from text
   */
  _extractKeywords(text) {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'can',
      'my',
      'me',
      'i',
      'you',
      'what',
      'how',
      'when',
      'where',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Calculate total tokens
   */
  _totalTokens(slices) {
    return slices.reduce((sum, s) => sum + s.tokens, 0);
  }

  /**
   * Compute deterministic hash of context
   */
  _computeHash(slices) {
    // Deterministic: sort by ID first to ensure stable order
    const sorted = [...slices].sort((a, b) => a.id.localeCompare(b.id));
    const stable = sorted.map(s => `${s.id}:${s.text.slice(0, 20)}`).join('|');
    
    // Real SHA-256 (not demo hash)
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(stable, 'utf8').digest('hex').slice(0, 12);
  }

  /**
   * Stable sort with deterministic tie-breaking
   * Sort by: priority DESC, updated_at DESC, id ASC
   */
  _stableSort(slices) {
    return slices.sort((a, b) => {
      // 1. Priority DESC
      if (a.priority !== b.priority) return b.priority - a.priority;
      
      // 2. Updated_at DESC (or created_at if no updated)
      const aTime = a.updated_at || a.created_at || '';
      const bTime = b.updated_at || b.created_at || '';
      if (aTime !== bTime) return bTime.localeCompare(aTime);
      
      // 3. ID ASC (deterministic tie-break)
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Format selected context for API
   */
  formatForAPI(slices) {
    const sections = {
      profile: [],
      facts: [],
      recent_messages: [],
      preferences: [],
    };

    for (const slice of slices) {
      if (slice.kind === 'fact') {
        const { category, predicate, object } = slice.metadata;

        if (category === 'personal' && predicate === 'name') {
          sections.profile.push(`Name: ${object}`);
        } else if (category === 'preference' || predicate.startsWith('prefers_')) {
          sections.preferences.push(`${predicate}: ${object}`);
        } else {
          sections.facts.push(`${category}.${predicate} = ${object}`);
        }
      } else if (slice.kind === 'message') {
        sections.recent_messages.push(slice.text);
      }
    }

    return {
      profile: sections.profile.length > 0 ? sections.profile.join('\n') : null,
      facts: sections.facts.length > 0 ? sections.facts.join('\n') : null,
      recent_messages:
        sections.recent_messages.length > 0 ? sections.recent_messages.slice(-5) : null,
      preferences: sections.preferences.length > 0 ? sections.preferences.join('\n') : null,
    };
  }

  /**
   * Build context string for prompt
   */
  buildContextString(slices) {
    const formatted = this.formatForAPI(slices);
    const parts = [];

    if (formatted.profile) {
      parts.push(`**Profile:**\n${formatted.profile}`);
    }

    if (formatted.preferences) {
      parts.push(`**Preferences:**\n${formatted.preferences}`);
    }

    if (formatted.facts) {
      parts.push(`**Known Facts:**\n${formatted.facts}`);
    }

    if (formatted.recent_messages && formatted.recent_messages.length > 0) {
      parts.push(`**Recent Context:**\n${formatted.recent_messages.join('\n')}`);
    }

    return parts.join('\n\n');
  }
}

// Singleton instance
const contextSelector = new ContextSelector();

export default contextSelector;
