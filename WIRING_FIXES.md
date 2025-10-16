# Memory Vault - Critical Wiring Fixes

**Status:** ⚠️ **90% Complete - Wiring Gaps Identified**

## The Problem

Algorithms are solid, but integration seams have risks:
1. ❌ **SQLCipher not actually enabled** (better-sqlite3 doesn't encrypt without SQLCipher build)
2. ❌ **No authoritative identity_id** (machine-ID derivation is wrong pattern)
3. ❌ **IPC surface too wide** (exposes raw DB methods)
4. ❌ **No selector hook points** (not wired into actual API calls)
5. ❌ **No reinforcement flow** (facts never get boosted after successful use)
6. ⚠️ **Migration not atomic** (can leave half-migrated state)

---

## Fix 1: SQLCipher Reality ✅

**Decision: Option B - Field-Level Encryption**

We don't have a reliable SQLCipher build, so:
- Keep plain SQLite (better-sqlite3)
- Encrypt sensitive fields ourselves (using Node's crypto)
- Simpler, no native toolchain pain
- Still meets privacy goal

**What to encrypt:**
- `messages.content` (contains user data)
- `facts.object` (contains values like "Philadelphia", "colin@example.com")
- `notes.text` (summaries)

**What stays plaintext:**
- IDs, timestamps, metadata (for indexing)
- `category`, `predicate` (for semantic search)
- `pii_level`, `consent_scope` (for filtering)

**Implementation:**
```javascript
// Encrypt field
_encryptField(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}:${encrypted}`;
}

// Decrypt field
_decryptField(encrypted) {
  if (!encrypted) return null;
  const [ivStr, data] = encrypted.split(':');
  const iv = Buffer.from(ivStr, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## Fix 2: Identity Management ✅

**Single source of truth for identity_id**

**Add meta table:**
```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Store:
-- meta('identity_id', uuid)
-- meta('schema_version', '1.0')
-- meta('migration_complete', '0' or '1')
-- meta('vault_created_at', timestamp)
-- meta('selector_version', '1')
```

**Initialization flow:**
```javascript
async initialize() {
  // 1. Get/generate identity_id (stored in keychain)
  this.identityId = await this.keychain.getIdentityId();
  if (!this.identityId) {
    this.identityId = uuidv4();
    await this.keychain.storeIdentityId(this.identityId);
  }
  
  // 2. Open DB
  this.db = new Database(this.vaultPath);
  
  // 3. Get encryption key
  this.encryptionKey = await this.keychain.retrieveKey();
  
  // 4. Initialize schema + meta
  await this._initializeSchema();
  
  // 5. Store identity_id in meta (if not exists)
  const storedId = this._getMeta('identity_id');
  if (!storedId) {
    this._setMeta('identity_id', this.identityId);
  }
}
```

---

## Fix 3: Hardened IPC Surface ✅

**Narrow, validated, consent-aware**

**Bad (current):**
```javascript
ipcMain.handle('vault:updateFact', (e, id, updates) => {
  return vault.updateFact(id, updates); // Too open!
});
```

**Good (fixed):**
```javascript
const ok = (data) => ({ ok: true, data });
const err = (m) => ({ ok: false, error: m });

ipcMain.handle('vault:set-fact', async (e, payload) => {
  // Validate
  if (!payload.category || !payload.predicate || !payload.object) {
    return err('bad_args');
  }
  if (payload.category.length > 50) return err('category_too_long');
  if (payload.object.length > 5000) return err('value_too_long');
  
  // Enforce PII cap (renderer can't set PII > 2 without explicit allow)
  const piiLevel = payload.pii_level ?? 1;
  if (piiLevel > 2 && !payload.allowHighPII) {
    return err('high_pii_denied');
  }
  
  try {
    const factId = await vault.setFact(
      sanitize(payload.category),
      sanitize(payload.predicate),
      sanitize(payload.object),
      { confidence: 0.8, pii_level: piiLevel }
    );
    return ok({ factId });
  } catch (error) {
    return err('set_failed');
  }
});

// Context selection (one shot)
ipcMain.handle('vault:build-context', async (e, { goal, tokenBudget = 1200 }) => {
  if (!goal || typeof goal !== 'string') return err('bad_args');
  if (tokenBudget > 3000) return err('budget_too_high');
  
  try {
    const context = await vault.selectContext(goal, { tokenBudget });
    return ok(context);
  } catch {
    return err('selector_failed');
  }
});

// Reinforce after success
ipcMain.handle('vault:reinforce', async (e, { factIds }) => {
  if (!Array.isArray(factIds)) return err('bad_args');
  if (factIds.length > 50) return err('too_many_facts');
  
  try {
    await vault.reinforceFacts(factIds);
    return ok(true);
  } catch {
    return err('reinforce_failed');
  }
});
```

**Sanitize helper:**
```javascript
function sanitize(str) {
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML
    .replace(/[^\w\s\-_.,!?@]/g, '') // Keep safe chars
    .trim()
    .slice(0, 5000); // Max length
}
```

---

## Fix 4: Selector Hook Points ✅

**Wire into actual API flow**

**Frontend (before API call):**
```javascript
// src/services/chatAPI.js
export async function sendGoal(goal, messages) {
  // 1. Build context from vault
  const { ok, data: context } = await window.vault.buildContext(goal, 1400);
  if (!ok) throw new Error('Context selection failed');
  
  // 2. Generate stable hash for delta detection
  const ctxHash = stableHash(JSON.stringify(context));
  
  // 3. Send to backend
  const res = await fetch('/api/v2/autonomous/quick', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Context-Hash': ctxHash,
      'X-Selector-Version': '1',
    },
    body: JSON.stringify({
      goal,
      context,
      messages: messages.slice(-6), // Last 6 messages
    }),
  });
  
  const payload = await res.json();
  
  // 4. After success, reinforce facts that were used
  if (payload?.meta?.usedFactIds?.length) {
    await window.vault.reinforce(payload.meta.usedFactIds);
  }
  
  return payload;
}
```

**Backend (re-filter context):**
```python
# api/routes/autonomous.py
@app.post('/api/v2/autonomous/quick')
async def autonomous_quick(request):
    goal = request.json.get('goal')
    context = request.json.get('context', {})
    
    # Re-filter context (never trust client)
    filtered_context = filter_context(context, max_pii=2)
    
    # Log for reproducibility
    ctx_hash = request.headers.get('X-Context-Hash')
    selector_version = request.headers.get('X-Selector-Version')
    logger.info(f"Context: hash={ctx_hash}, version={selector_version}")
    
    # Execute with filtered context
    result = await execute_goal(goal, filtered_context)
    
    # Track which facts were actually used
    used_fact_ids = extract_used_facts(result)
    
    return {
        'response': result,
        'meta': {
            'usedFactIds': used_fact_ids,
            'selectorVersion': selector_version,
        }
    }
```

---

## Fix 5: Reinforcement Flow ✅

**After successful API call:**

```javascript
// In chatAPI.js after storing assistant message
async function handleSuccessfulReply(assistantMessage, usedFactIds) {
  // 1. Store message
  await window.vault.addMessage('assistant', assistantMessage);
  
  // 2. Reinforce facts that were used
  if (usedFactIds?.length) {
    const { ok } = await window.vault.reinforce(usedFactIds);
    if (ok) {
      console.log(`Reinforced ${usedFactIds.length} facts`);
    }
  }
}
```

**Backend (track which facts were used):**
```python
def extract_used_facts(prompt_with_context):
    """Extract fact IDs that made it into the final prompt"""
    # Parse context from prompt
    # Return list of fact IDs that were included
    used_ids = []
    for fact in context_facts:
        if fact['text'] in prompt_with_context:
            used_ids.append(fact['id'])
    return used_ids
```

---

## Fix 6: Atomic Migration ✅

**Transaction-based migration:**

```javascript
async function runMigration() {
  const hasBackup = await createBackup();
  if (!hasBackup) throw new Error('Backup failed');
  
  // All-or-nothing transaction
  try {
    await vault.db.transaction(async () => {
      await migrateProfile();
      await migrateFacts();
      await migrateSessions();
      await migrateMessages();
      await migratePreferences();
      
      // Mark complete
      vault._setMeta('migration_complete', '1');
      vault._setMeta('migrated_at', new Date().toISOString());
    });
    
    console.log('✅ Migration complete');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // Rollback: delete vault, restore JSONs
    await vault.destroy();
    await restoreBackup();
    
    return false;
  }
}
```

---

## Fix 7: Deterministic Selection ✅

**Version pinning + stable sort:**

```javascript
class ContextSelector {
  constructor() {
    this.version = '1.0'; // Pin version
    this.alpha = 0.7; // Semantic weight (fixed)
    this.defaultBudget = 1200;
  }
  
  async selectContext(goal, vault, options = {}) {
    const slices = await this._getCandidates(vault);
    const scored = this._scoreSlices(goal, slices, this.alpha);
    
    // Stable sort (priority DESC, updated_at DESC, id ASC)
    scored.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.updated_at !== b.updated_at) return b.updated_at.localeCompare(a.updated_at);
      return a.id.localeCompare(b.id);
    });
    
    const filtered = this._filterByPolicy(scored, options);
    const packed = this._packToBudget(filtered, options.tokenBudget);
    
    return {
      slices: packed,
      meta: {
        version: this.version,
        hash: this._computeHash(packed),
        totalTokens: this._sumTokens(packed),
      },
    };
  }
  
  _computeHash(slices) {
    const stable = slices.map(s => `${s.id}:${s.text.slice(0, 20)}`).join('|');
    return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 12);
  }
}
```

---

## Fix 8: Double PII Enforcement ✅

**Client-side:**
```javascript
function filterByPII(slices, maxPII = 1) {
  return slices.filter(s => s.pii_level <= maxPII);
}

function filterByConsent(slices) {
  return slices.filter(s => s.consent_scope !== 'never_upload');
}
```

**Server-side:**
```python
def filter_context(context, max_pii=1):
    """Re-filter context (never trust client)"""
    filtered = {
        'facts': [],
        'messages': [],
        'preferences': [],
    }
    
    for fact in context.get('facts', []):
        if fact.get('pii_level', 0) <= max_pii:
            if fact.get('consent_scope') != 'never_upload':
                filtered['facts'].append(fact)
    
    # Same for messages, preferences
    return filtered
```

---

## Fix 9: Health Checks ✅

```javascript
// IPC handler
ipcMain.handle('vault:health', async () => {
  try {
    const stats = await vault.getStats();
    const meta = await vault.getAllMeta();
    
    return ok({
      stats,
      meta: {
        schema_version: meta.schema_version,
        migration_complete: meta.migration_complete === '1',
        identity_id_suffix: meta.identity_id?.slice(-6),
        selector_version: meta.selector_version,
        vault_created_at: meta.vault_created_at,
      },
      health: 'ok',
    });
  } catch {
    return err('health_check_failed');
  }
});
```

---

## Fix 10: Kill Switch ✅

**Environment flag for fallback:**

```javascript
// In main.cjs
const USE_VAULT = process.env.MAX_MEMORY_FALLBACK !== '1';

if (USE_VAULT) {
  try {
    const vaultReady = await vaultIntegration.initialize();
    if (!vaultReady) throw new Error('Vault init failed');
    memorySystem = vaultIntegration.getVault();
  } catch (error) {
    console.error('Vault failed, using fallback:', error);
    memorySystem = new LocalMemoryManager(); // Old system
  }
} else {
  console.warn('Using legacy memory system (MAX_MEMORY_FALLBACK=1)');
  memorySystem = new LocalMemoryManager();
}
```

---

## Remaining Work

1. ✅ Implement field-level encryption
2. ✅ Add meta table + identity management
3. ✅ Rewrite IPC handlers (narrow + validated)
4. ✅ Add reinforceFacts() method
5. ✅ Create integration hooks doc
6. ✅ Add transaction wrapper for migration
7. ✅ Version pin + stable sort
8. ✅ Add health check endpoint
9. ✅ Add kill switch

**Status:** Ready to implement fixes
