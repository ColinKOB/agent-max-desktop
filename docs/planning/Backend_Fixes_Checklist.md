# Backend Fixes Checklist

**Target**: https://agentmax-production.up.railway.app (Railway hosted Agent_Max)  
**Purpose**: Fix critical issues identified during fire testing  
**Priority**: High - Blocking production chat streaming  
**Started**: 2025-11-05  
**Completed**: 2025-11-05 12:54 UTC  
**Status**: ✅ ALL FIXES DEPLOYED AND VERIFIED - FIRE TESTS PASSING

## Overview
Fixing the 3 critical backend issues identified during fire testing, plus running comprehensive API validation.

---

## ✅ Completed

- [x] **Item 0**: Run autonomous multi-step fire test with enhanced retry logic
  - Result: Mixed (some finalLen=0, but no 429s)
  - Artifact: autonomous_multistep_2025-11-05T10-33-29-526Z.jsonl
- [x] **Pre-work**: Disabled telemetry on Railway (ENABLE_TELEMETRY=0) to eliminate noise
- [x] **Pre-work**: Client-side mitigations in src/services/api.js (truncation, JSON fallback)
- [x] **Item 1**: Fixed Chat SSE streaming fallback (use_responses_api reset)
- [x] **Item 2**: Raised message length limit 4000→16000
- [x] **Item 3**: Fixed telemetry path to use TELEMETRY_DIR env var
- [x] **Deploy**: Triggered Railway deployment with all fixes
- [x] **Item 4**: Added OpenTelemetry import safety guard to prevent streaming router failures
- [x] **Item 5**: Verified streaming router loaded and mounted correctly
- [x] **Item 6**: Re-ran chat stream fire test - ALL TESTS PASSING ✅
  - Artifact: chat_fire_test_2025-11-05T12-54-37-156Z.jsonl
  - Real tokens streaming, no more ACK-without-content
  - Long messages working (16k limit active)
  - Autonomous streaming working with final_response
- [x] **Cleanup**: Removed debug endpoint after successful diagnosis

---

## 🔄 In Progress

### Item 1: [backend] Patch Responses API & SSE Bridge for Chat Streaming
**Status**: ✅ COMPLETE (deployed to Railway)  
**Files to modify**:
- Backend chat streaming endpoint handler
- Responses API payload construction
- SSE bridge/streaming logic

**Changes**:
- [x] Fix Responses API payload for gpt-5 (model, stream=true, correct schema) - Already correct
- [x] Add upstream 4xx/5xx body logging for diagnosis - Already present
- [x] Ensure Chat Completions fallback has stream=true - Verified present
- [x] Forward provider deltas to client SSE - Fixed: set use_responses_api=False on fallback
- [x] Accumulate final_response and emit on done - Already present (line 1035)
- [x] Add token forwarding counters - Already present

**Evidence**: Railway logs show "Responses API error 400 → fallback → 0 tokens forwarded"
**Fix Applied**: Added logic to reset use_responses_api=False when falling back so token forwarding works (lines 836-839)

---

### Item 2: [backend] Raise Message Length Limit
**Status**: ✅ COMPLETE  
**Files modified**:
- api/constants.py (line 18)

**Changes**:
- [x] Raise max_length from 4000 → 16000 (env-configurable later if needed)
- [ ] Add server-side truncation with clear user note if exceeded (deferred - not needed with 16k limit)
- [ ] Optional: Implement chunking for very long inputs (deferred - not needed yet)

**Evidence**: Fire test 422 on long_context case (>4000 chars)
**Fix Applied**: MAX_MESSAGE_LENGTH = 16000 with comment explaining increase

---

### Item 3: [backend] Fix Telemetry Path/Permissions
**Status**: ✅ COMPLETE  
**Files modified**:
- Dockerfile.production (lines 54, 70 - already correct)
- api/streaming/chat_stream.py (lines 1039-1045, 1119-1121)
- api/routers/chat.py (lines 362-368, 412-414)

**Changes**:
- [x] Standardize to /var/lib/agentmax/telemetry (Dockerfile line 70 TELEMETRY_DIR env)
- [x] Create directory and set ownership to appuser in Dockerfile (line 54)
- [x] Graceful degradation if local write fails (changed logger.warning → logger.debug)
- [x] Respect TELEMETRY_DIR env var in logging code (previously hardcoded)

**Evidence**: Railway logs "[Errno 13] Permission denied: '/app/telemetry_data'"
**Fix Applied**: Telemetry code now reads TELEMETRY_DIR env var, falls back gracefully, and uses debug-level logging

---

### Item 4: [tests] Run API Smokes (Non-Chat Surfaces)
**Status**: Ready to run  
**Command**:
```bash
API_URL="https://agentmax-production.up.railway.app" \
TEST_API_KEY="$(grep -E '^VITE_API_KEY=' .env.production | sed 's/VITE_API_KEY=//')" \
npm run test:api -s
```

**Changes**:
- [ ] Execute Playwright API smoke tests
- [ ] Generate play-results.json + HTML report
- [ ] Create triage summary at tests/e2e/_reports/latest-triage.md

---

### Item 5: [docs] Update Backend_Fire_Test_Results.md
**Status**: Ongoing  
**Changes**:
- [x] Documented autonomous re-run (2025-11-05 10:33 UTC)
- [ ] Append API smokes results
- [ ] Append chat stream re-run results (after backend fixes)
- [ ] Add final pass/fail matrix

---

## 📋 Next Actions

1. ✅ **Access backend repo** (Agent_Max folder) - DONE
2. ✅ **Patch Items 1-3** in backend codebase - DONE
3. ✅ **Deploy** updated backend to Railway - DONE (in progress)
4. ⏳ **Wait for deployment** to complete (~2-3 min)
5. 🔜 **Re-enable telemetry** on Railway (set ENABLE_TELEMETRY=1)
6. 🔜 **Run API smokes** (Item 4) - command ready
7. 🔜 **Re-run fire tests** to validate fixes
8. 🔜 **Update docs** with final results

### Commands to Run After Deploy Completes:

```bash
# 1. Re-enable telemetry
# (via Railway dashboard or CLI - set ENABLE_TELEMETRY=1, TELEMETRY_ENABLED=true)

# 2. Run API smokes
cd /Users/colinobrien/Desktop/Coding\ Projects/Agent-Max-Master/agent-max-desktop
API_URL="https://agentmax-production.up.railway.app" \
TEST_API_KEY="$(grep -E '^VITE_API_KEY=' .env.production | sed 's/VITE_API_KEY=//')" \
npm run test:api -s

# 3. Re-run chat stream fire test
node scripts/integration/chat_stream_fire_test.mjs

# 4. Re-run autonomous multi-step fire test
node scripts/integration/autonomous_multistep_fire_test.mjs
```

---

## 🚫 Blockers

- Backend repo access verification in progress
- Will update this checklist as each item completes

