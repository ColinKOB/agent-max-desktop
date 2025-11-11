/**
 * Secure Vault IPC Handlers
 * Narrow, validated, consent-aware API for renderer
 * Replaces the wide-open vault-ipc-handlers.cjs
 */

const { ipcMain } = require('electron');

// Response helpers
const ok = (data) => ({ ok: true, data });
const err = (message) => ({ ok: false, error: message });

// Sanitize helper
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML
    .replace(/[^\w\s\-_.,!?@]/g, '') // Keep safe chars
    .trim()
    .slice(0, 5000); // Max length
}

class SecureVaultIPCHandlers {
  constructor(vault) {
    this.vault = vault;
    
    // Rate limiting state
    this.rateLimits = new Map(); // method -> { count, resetTime }
  }

  /**
   * Rate limit check
   * @param {string} method - IPC method name
   * @param {number} maxCalls - Max calls per window
   * @param {number} windowMs - Time window in ms
   */
  _checkRateLimit(method, maxCalls, windowMs) {
    const now = Date.now();
    const state = this.rateLimits.get(method);

    if (!state || now > state.resetTime) {
      // New window
      this.rateLimits.set(method, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (state.count >= maxCalls) {
      return false; // Rate limited
    }

    state.count++;
    return true;
  }

  /**
   * Register all IPC handlers (secure version)
   */
  register() {
    // ============================================
    // STATS & HEALTH
    // ============================================

    ipcMain.handle('vault:get-stats', async () => {
      try {
        return ok(await this.vault.getStats());
      } catch (error) {
        return err('stats_failed');
      }
    });

    ipcMain.handle('vault:health', async () => {
      try {
        const stats = this.vault.getStats();
        const meta = this.vault._getAllMeta();

        return ok({
          stats,
          meta: {
            schema_version: meta.schema_version,
            selector_version: meta.selector_version,
            migration_complete: meta.migration_complete === '1',
            identity_id_suffix: meta.identity_id?.slice(-6),
            encryption_mode: meta.encryption_mode,
          },
          health: 'ok',
        });
      } catch (error) {
        return err('health_check_failed');
      }
    });

    // ============================================
    // IDENTITY (read-only)
    // ============================================

    ipcMain.handle('vault:get-identity', async () => {
      try {
        return ok(this.vault.getIdentity());
      } catch (error) {
        return err('identity_failed');
      }
    });

    ipcMain.handle('vault:set-display-name', async (e, { name }) => {
      if (!name || typeof name !== 'string') return err('bad_args');
      if (name.length > 100) return err('name_too_long');

      try {
        const sanitized = sanitize(name);
        return ok(this.vault.setDisplayName(sanitized));
      } catch (error) {
        return err('update_failed');
      }
    });

    // ============================================
    // SESSIONS
    // ============================================

    ipcMain.handle('vault:create-session', async (e, { goal }) => {
      if (goal && typeof goal !== 'string') return err('bad_args');
      if (goal && goal.length > 1000) return err('goal_too_long');

      try {
        const sessionId = this.vault.createSession(goal ? sanitize(goal) : null);
        return ok({ sessionId });
      } catch (error) {
        return err('session_create_failed');
      }
    });

    ipcMain.handle('vault:end-session', async (e, { summary }) => {
      try {
        this.vault.endSession(summary ? sanitize(summary) : null);
        return ok(true);
      } catch (error) {
        return err('session_end_failed');
      }
    });

    ipcMain.handle('vault:get-all-sessions', async (e, { limit = 50 }) => {
      if (limit > 200) return err('limit_too_high');

      try {
        return ok(this.vault.getAllSessions(limit));
      } catch (error) {
        return err('sessions_failed');
      }
    });

    // ============================================
    // MESSAGES
    // ============================================

    ipcMain.handle('vault:add-message', async (e, { sessionId, role, content }) => {
      // Validate role
      if (!['user', 'assistant', 'system'].includes(role)) {
        return err('invalid_role');
      }

      // Validate content
      if (!content || typeof content !== 'string') return err('bad_args');
      if (content.length > 50000) return err('message_too_long');

      try {
        const messageId = this.vault.addMessage(role, content, sessionId);
        return ok({ messageId });
      } catch (error) {
        return err('message_add_failed');
      }
    });

    ipcMain.handle('vault:get-recent-messages', async (e, { count = 10, sessionId }) => {
      if (count > 100) return err('count_too_high');

      try {
        return ok(this.vault.getRecentMessages(count, sessionId));
      } catch (error) {
        return err('messages_failed');
      }
    });

    // ============================================
    // FACTS (with PII filtering)
    // ============================================

    ipcMain.handle('vault:set-fact', async (e, payload) => {
      // Validate required fields
      if (!payload.category || !payload.predicate || !payload.object) {
        return err('missing_fields');
      }

      // Validate types
      if (typeof payload.category !== 'string' || typeof payload.predicate !== 'string') {
        return err('invalid_types');
      }

      // Validate lengths
      if (payload.category.length > 50) return err('category_too_long');
      if (payload.predicate.length > 100) return err('predicate_too_long');
      if (String(payload.object).length > 5000) return err('value_too_long');

      // Enforce PII cap (renderer can't set PII > 2 without explicit allow)
      const piiLevel = payload.pii_level ?? 1;
      if (piiLevel > 2 && !payload.allowHighPII) {
        return err('high_pii_denied');
      }
      if (piiLevel < 0 || piiLevel > 3) {
        return err('invalid_pii_level');
      }

      try {
        const factId = this.vault.setFact(
          sanitize(payload.category),
          sanitize(payload.predicate),
          sanitize(String(payload.object)),
          {
            confidence: payload.confidence ?? 0.8,
            pii_level: piiLevel,
            consent_scope: payload.consent_scope ?? 'default',
            source_msg_id: payload.source_msg_id,
          }
        );
        return ok({ factId });
      } catch (error) {
        return err('set_fact_failed');
      }
    });

    ipcMain.handle('vault:get-all-facts', async (e, { category, includePII = false }) => {
      try {
        let facts = this.vault.getAllFacts(category);

        // Filter by PII level (default: only include 0-1)
        const maxPII = includePII ? 3 : 1;
        facts = facts.filter((f) => f.pii_level <= maxPII);

        // Filter by consent (never include never_upload)
        facts = facts.filter((f) => f.consent_scope !== 'never_upload');

        return ok(facts);
      } catch (error) {
        return err('facts_failed');
      }
    });

    ipcMain.handle('vault:update-fact', async (e, { id, updates }) => {
      if (!id) return err('missing_id');
      if (!updates || typeof updates !== 'object') return err('bad_args');

      // Sanitize object if provided
      if (updates.object) {
        updates.object = sanitize(String(updates.object));
      }

      // Validate PII level
      if (updates.pii_level !== undefined) {
        if (updates.pii_level < 0 || updates.pii_level > 3) {
          return err('invalid_pii_level');
        }
      }

      try {
        return ok(this.vault.updateFact(id, updates));
      } catch (error) {
        return err('update_failed');
      }
    });

    ipcMain.handle('vault:delete-fact', async (e, { id }) => {
      if (!id) return err('missing_id');

      try {
        this.vault.deleteFact(id);
        return ok(true);
      } catch (error) {
        return err('delete_failed');
      }
    });

    // ============================================
    // CONTEXT SELECTION (one-shot)
    // ============================================

    ipcMain.handle('vault:build-context', async (e, { goal, tokenBudget = 1200 }) => {
      // Rate limit: 3 calls per second
      if (!this._checkRateLimit('build-context', 3, 1000)) {
        return err('rate_limited');
      }

      // Validate goal
      if (!goal || typeof goal !== 'string') return err('bad_args');
      if (goal.length > 2000) return err('goal_too_long');

      // Validate budget
      if (tokenBudget > 3000) return err('budget_too_high');
      if (tokenBudget < 100) return err('budget_too_low');

      try {
        // Basic context (will be replaced with full contextSelector)
        const facts = this.vault.getAllFacts();
        const messages = this.vault.getRecentMessages(6); // Cap at 6

        // Filter by PII and consent
        const filtered = facts.filter(
          (f) => f.pii_level <= 2 && f.consent_scope !== 'never_upload'
        );

        // Cap messages to 6 (server will also enforce)
        const cappedMessages = messages.slice(-6);

        // Log redacted (no content, only metadata)
        console.log(`[Context] goal_length=${goal.length}, facts=${filtered.length}, messages=${cappedMessages.length}, budget=${tokenBudget}`);

        return ok({
          facts: filtered.slice(0, 10),
          messages: cappedMessages,
          meta: {
            selector_version: '1',
            total_facts: facts.length,
            selected_facts: filtered.length,
          },
        });
      } catch (error) {
        console.error('[Context] Error:', error.message); // Don't log full error
        return err('context_build_failed');
      }
    });

    // ============================================
    // REINFORCEMENT (after success)
    // ============================================

    ipcMain.handle('vault:reinforce', async (e, { factIds }) => {
      if (!Array.isArray(factIds)) return err('bad_args');
      if (factIds.length > 25) return err('too_many_facts'); // Reduced from 50

      // Validate all IDs are strings
      if (!factIds.every((id) => typeof id === 'string')) {
        return err('invalid_fact_ids');
      }

      try {
        // Vault will cap at 25 and de-duplicate
        this.vault.reinforceFacts(factIds);
        
        // Log redacted (only count)
        console.log(`[Reinforce] count=${factIds.length}`);
        
        return ok({ reinforced: factIds.length });
      } catch (error) {
        console.error('[Reinforce] Error:', error.message);
        return err('reinforce_failed');
      }
    });

    // ============================================
    // SEARCH
    // ============================================

    ipcMain.handle('vault:search-messages', async (e, { query, limit = 10 }) => {
      if (!query || typeof query !== 'string') return err('bad_args');
      if (query.length > 200) return err('query_too_long');
      if (limit > 50) return err('limit_too_high');

      try {
        return ok(this.vault.searchMessages(query, limit));
      } catch (error) {
        return err('search_failed');
      }
    });

    ipcMain.handle('vault:search-facts', async (e, { query }) => {
      if (!query || typeof query !== 'string') return err('bad_args');
      if (query.length > 200) return err('query_too_long');

      try {
        let results = this.vault.searchFacts(query);

        // Filter by consent (never include never_upload)
        results = results.filter((f) => f.consent_scope !== 'never_upload');

        return ok(results);
      } catch (error) {
        return err('search_failed');
      }
    });

    console.log('✓ Secure vault IPC handlers registered');
  }

  /**
   * Unregister all handlers
   */
  unregister() {
    const handlers = [
      'vault:get-stats',
      'vault:health',
      'vault:get-identity',
      'vault:set-display-name',
      'vault:create-session',
      'vault:end-session',
      'vault:get-all-sessions',
      'vault:add-message',
      'vault:get-recent-messages',
      'vault:set-fact',
      'vault:get-all-facts',
      'vault:update-fact',
      'vault:delete-fact',
      'vault:build-context',
      'vault:reinforce',
      'vault:search-messages',
      'vault:search-facts',
    ];

    handlers.forEach((handler) => {
      ipcMain.removeHandler(handler);
    });

    console.log('✓ Secure vault IPC handlers unregistered');
  }
}

module.exports = SecureVaultIPCHandlers;
