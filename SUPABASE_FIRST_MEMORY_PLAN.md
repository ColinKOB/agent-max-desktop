# Supabase-First Memory Migration Plan

**Goal**: Replace Electron local memory with Supabase-backed services while maintaining offline resilience.

**Date**: 2025-10-29

---

## Phase 1: Audit and Inventory
- [ ] Inventory all Electron memory API calls
- [ ] Map current local storage keys to Supabase tables
- [ ] Identify critical paths that need offline fallback

---

## Phase 2: Create Supabase Memory Service
- [ ] Create `src/services/supabaseMemory.js` with unified API
- [ ] Implement profile/facts/preferences/session methods
- [ ] Add local fallback with sync queue
- [ ] Add comprehensive error handling

---

## Phase 3: Create Test Suite
- [ ] Create `tests/supabaseMemory.test.js` with Jest
- [ ] Test online/offline scenarios
- [ ] Test conflict resolution
- [ ] Test sync queue behavior

---

## Phase 4: Migrate Components
- [ ] Update App.jsx to use supabaseMemory for profile
- [ ] Update AppleFloatBar to use supabaseMemory for preferences
- [ ] Update Dashboard/Knowledge pages to use supabaseMemory
- [ ] Keep electron.memory as fallback when Supabase unavailable

---

## Phase 5: Add Consent UI
- [ ] Create consent component for data scopes
- [ ] Integrate into onboarding flow
- [ ] Add settings toggle for consent
- [ ] Persist consent to Supabase users.scopes

---

## Phase 6: Cleanup and Documentation
- [ ] Remove deprecated electron.memory direct calls
- [ ] Update API documentation
- [ ] Add migration guide for existing users
- [ ] Final integration testing

---

## Success Criteria
- All memory operations work through Supabase when online
- Graceful fallback to Electron local when offline
- User consent respected and configurable
- Zero data loss during migration
- All tests pass (95%+ coverage)
