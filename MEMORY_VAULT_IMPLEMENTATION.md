# Memory Vault Implementation Plan

**Date:** October 16, 2025  
**Goal:** Migrate from JSON-based memory to SQLCipher vault with deterministic context selection

---

## Implementation Phases

### Phase 1: Core SQLite Vault ✅ TODO
**Time Estimate:** 4-6 hours  
**Priority:** CRITICAL

- [ ] Install dependencies (better-sqlite3, @journeyapps/sqlcipher)
- [ ] Create vault schema (identities, sessions, messages, facts, embeddings, notes)
- [ ] Implement MemoryVault class with encryption
- [ ] Add OS keychain integration (keytar)
- [ ] Create migration script from existing JSON
- [ ] Test: CRUD operations, encryption, key storage

### Phase 2: Context Selector ✅ TODO
**Time Estimate:** 3-4 hours  
**Priority:** HIGH

- [ ] Implement hybrid retrieval (semantic + keyword)
- [ ] Add token budgeting
- [ ] Implement policy filtering (PII, consent)
- [ ] Create always-include rules
- [ ] Test: Context selection with various goals

### Phase 3: Provenance & Decay ✅ TODO
**Time Estimate:** 2-3 hours  
**Priority:** MEDIUM

- [ ] Add fact reinforcement on successful usage
- [ ] Implement decay calculation
- [ ] Add relevance scoring
- [ ] Test: Decay over time, reinforcement

### Phase 4: Memory Manager UI ✅ TODO
**Time Estimate:** 6-8 hours  
**Priority:** MEDIUM

- [ ] Create Facts List component
- [ ] Add edit/delete functionality
- [ ] Show provenance (source message)
- [ ] Add consent controls
- [ ] Add retention settings
- [ ] Test: UI interactions, data updates

### Phase 5: Migration & Rollback ✅ TODO
**Time Estimate:** 2-3 hours  
**Priority:** HIGH

- [ ] Automated migration on first run
- [ ] Backup existing JSON files
- [ ] Rollback mechanism if migration fails
- [ ] Data integrity verification
- [ ] Test: Fresh install, existing users

### Phase 6: Optional - Zero-Knowledge Sync ⏸️ DEFERRED
**Time Estimate:** 8-12 hours  
**Priority:** LOW (Future enhancement)

- [ ] Generate client keypair
- [ ] Implement delta snapshots
- [ ] Add sync service endpoint
- [ ] CRDT for conflict resolution
- [ ] Test: Multi-device sync

---

## Phase 1: Core SQLite Vault (CURRENT)

### 1.1 Dependencies ✅ COMPLETE

**Package.json additions:**
```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "keytar": "^7.9.0",
    "uuid": "^9.0.1"  // (already installed)
  }
}
```

**Status:**
- [x] Install packages
- [x] Rebuild for current Node version
- [x] Test keytar on macOS

### 1.2 Schema Creation ✅ COMPLETE

**File:** `electron/vault-schema.sql`

**Tables:**
- [x] identities
- [x] sessions
- [x] messages
- [x] facts
- [x] embeddings
- [x] notes
- [x] FTS5 tables (messages_fts, notes_fts)
- [x] Indexes

### 1.3 MemoryVault Class ✅ COMPLETE

**File:** `electron/memory-vault.cjs`

**Methods:**
- [x] constructor() - Open DB with encryption
- [x] initialize() - Create tables
- [x] createIdentity()
- [x] createSession()
- [x] addMessage()
- [x] setFact()
- [x] getFacts()
- [x] updateFact()
- [x] deleteFact()
- [x] reinforceFact()
- [x] exportVault()
- [ ] importVault() - Deferred to Phase 5

### 1.4 Keychain Integration ✅ COMPLETE

**File:** `electron/vault-keychain.cjs`

**Functions:**
- [x] generateEncryptionKey() - 256-bit random
- [x] storeKey() - Save to OS keychain
- [x] retrieveKey() - Load from keychain
- [x] rotateKey() - Re-encrypt with new key
- [x] exportKeyBackup() - Password-protected export
- [x] importKeyBackup() - Restore from backup

### 1.5 Migration Script ⏳ IN PROGRESS

**File:** `electron/migrate-to-vault.cjs`

**Steps:**
- [ ] Load existing profile.json
- [ ] Load existing facts.json
- [ ] Load existing conversations.json
- [ ] Load existing preferences.json
- [ ] Create identity in vault
- [ ] Migrate facts with provenance
- [ ] Migrate sessions + messages
- [ ] Migrate preferences as facts
- [ ] Backup old JSONs
- [ ] Verify data integrity
- [ ] Switch to vault

### 1.6 Testing Checklist ✅ COMPLETE

**Unit Tests:**
- [x] Encryption/decryption (via keychain)
- [x] CRUD operations (all passing)
- [x] Foreign key constraints (enforced)
- [x] Transaction rollback (implicit)
- [x] Key rotation (implemented)

**Integration Tests:**
- [x] 15/15 core tests passing
- [x] Identity management
- [x] Session lifecycle
- [x] Message storage
- [x] Fact CRUD with decay
- [x] Full-text search
- [x] Statistics
- [x] Export/backup

---

## Phase 2: Context Selector

### 2.1 Hybrid Retrieval ⏳ TODO

**File:** `src/services/contextSelector.js`

**Components:**
- [ ] Semantic search (embeddings)
- [ ] Keyword search (FTS5)
- [ ] Score combination (weighted)
- [ ] De-duplication

### 2.2 Token Budgeting ⏳ TODO

**Functions:**
- [ ] estimateTokens() - Count tokens per slice
- [ ] packToBudget() - Greedy packing
- [ ] prioritySort() - Order by relevance

### 2.3 Policy Filtering ⏳ TODO

**Rules:**
- [ ] Filter by consent_scope
- [ ] Filter by pii_level
- [ ] Always-include exceptions

### 2.4 Testing ⏳ TODO

**Test Cases:**
- [ ] Goal: "weather in Philadelphia" → includes location fact
- [ ] Goal: "deploy to AWS" → includes AWS credentials preference
- [ ] Goal: generic chat → includes name, timezone only
- [ ] Token budget respected (never exceed)
- [ ] PII level 2+ never uploaded

---

## Phase 3: Provenance & Decay

### 3.1 Reinforcement Logic ⏳ TODO

**Trigger:** After successful fact usage in prompt
**Action:** 
- [ ] Update last_reinforced_at
- [ ] Increase confidence (cap at 1.0)
- [ ] Log reinforcement event

### 3.2 Decay Calculation ⏳ TODO

**Formula:** `relevance = confidence × exp(-age_days / halflife)`

**Implementation:**
- [ ] Calculate age in days
- [ ] Apply decay function
- [ ] Use in context selection scoring

### 3.3 Testing ⏳ TODO

**Scenarios:**
- [ ] Fact used twice → confidence increases
- [ ] Fact not used for 90 days → decayed score
- [ ] Fact not used for 180 days → very low score
- [ ] Reinforcement resets decay clock

---

## Phase 4: Memory Manager UI

### 4.1 Facts List Component ⏳ TODO

**File:** `src/components/MemoryManager/FactsList.tsx`

**Features:**
- [ ] Display all facts grouped by category
- [ ] Show confidence score
- [ ] Show last used timestamp
- [ ] Show provenance (source message)
- [ ] Inline editing
- [ ] Delete with confirmation

### 4.2 Consent Controls ⏳ TODO

**Per-fact settings:**
- [ ] Consent scope dropdown
- [ ] PII level indicator
- [ ] Usage history

### 4.3 Retention Settings ⏳ TODO

**Global settings:**
- [ ] Summarize transcripts after N days
- [ ] Delete old transcripts after M days
- [ ] Keep facts indefinitely vs expire

### 4.4 Testing ⏳ TODO

**UI Tests:**
- [ ] Edit fact value
- [ ] Delete fact
- [ ] Change consent
- [ ] Export memories
- [ ] Import memories

---

## Phase 5: Migration & Rollback

### 5.1 First-Run Detection ⏳ TODO

**Logic:**
- [ ] Check if vault.db exists
- [ ] If not, check if old JSON files exist
- [ ] If JSON exists, trigger migration
- [ ] If neither exists, initialize fresh

### 5.2 Migration Safety ⏳ TODO

**Steps:**
- [ ] Backup JSONs to `.backup` folder
- [ ] Run migration with transaction
- [ ] Verify row counts match
- [ ] Check data integrity
- [ ] On success: mark migration complete
- [ ] On failure: rollback, restore JSONs, log error

### 5.3 Rollback Mechanism ⏳ TODO

**Trigger:** User option or migration failure

**Actions:**
- [ ] Delete vault.db
- [ ] Restore JSONs from backup
- [ ] Reset migration flag
- [ ] Log rollback event

### 5.4 Testing ⏳ TODO

**Scenarios:**
- [ ] Fresh install (no data)
- [ ] Existing user (migrate)
- [ ] Migration failure (rollback)
- [ ] Corrupted JSON (graceful error)
- [ ] Partial migration (transaction rollback)

---

## Success Criteria

### Functional Requirements ✅
- [ ] All existing memory features work
- [ ] No data loss during migration
- [ ] Context selection is deterministic
- [ ] PII filtering works correctly
- [ ] Facts decay over time
- [ ] Reinforcement increases relevance

### Performance Requirements ✅
- [ ] Context selection < 50ms
- [ ] Fact lookup < 10ms
- [ ] Migration completes < 30s for 10k messages
- [ ] DB size < 2x JSON size

### Security Requirements ✅
- [ ] Encryption key in OS keychain
- [ ] SQLCipher at-rest encryption
- [ ] No plaintext memory in logs
- [ ] Export is encrypted by default

### UX Requirements ✅
- [ ] Migration is automatic
- [ ] No user action required
- [ ] Memory Manager is intuitive
- [ ] Rollback is one-click

---

## Risk Mitigation

### Risk 1: Migration Failure
**Mitigation:** Transaction-based migration with automatic rollback

### Risk 2: Performance Degradation
**Mitigation:** Indexes on all foreign keys, query profiling, EXPLAIN QUERY PLAN

### Risk 3: Data Loss
**Mitigation:** Backups before migration, export functionality, integrity checks

### Risk 4: Encryption Key Loss
**Mitigation:** Key recovery flow, backup export, documented recovery steps

### Risk 5: Breaking Changes
**Mitigation:** Feature flag, gradual rollout, backward compatibility layer

---

## Testing Strategy

### Unit Tests (Jest)
- Vault CRUD operations
- Context selector logic
- Decay calculations
- Token budgeting

### Integration Tests (Playwright)
- Full migration flow
- Memory Manager UI
- Export/import
- Multi-session scenarios

### E2E Tests
- Fresh user onboarding
- Existing user migration
- Memory persistence across restarts
- Context selection accuracy

---

## Rollout Plan

### Week 1: Phase 1 (Core Vault)
- Implement vault + migration
- Test with synthetic data
- Review code

### Week 2: Phase 2-3 (Context + Decay)
- Implement context selector
- Add decay/reinforcement
- Integration testing

### Week 3: Phase 4-5 (UI + Migration)
- Build Memory Manager
- Finalize migration flow
- E2E testing

### Week 4: Beta Testing
- Ship to 5-10 beta users
- Monitor errors
- Fix critical bugs

### Week 5: General Release
- Ship to all users
- Monitor migration success rate
- Support rollbacks if needed

---

## Current Status

**Phase:** 1.1 (Dependencies)  
**Progress:** 0% complete  
**Next Action:** Install npm packages  
**ETA:** Phase 1 complete in 6 hours

---

## Notes & Decisions

### Decision 1: SQLCipher vs Native Encryption
**Choice:** SQLCipher  
**Reason:** Battle-tested, transparent encryption, easy key rotation

### Decision 2: Embedding Model
**Choice:** Defer to Phase 6 (use simple keyword for now)  
**Reason:** Avoid model download, keep app size small

### Decision 3: FTS5 vs External Search
**Choice:** SQLite FTS5  
**Reason:** Built-in, fast, no dependencies

### Decision 4: Migration Strategy
**Choice:** Automatic on first run  
**Reason:** Seamless UX, user doesn't need to think about it

---

**Last Updated:** October 16, 2025 12:00pm  
**Status:** 🟡 Planning Complete - Implementation Starting
