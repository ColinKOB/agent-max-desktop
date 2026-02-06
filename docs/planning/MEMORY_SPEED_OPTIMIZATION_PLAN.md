# Memory & Speed Optimization Plan

**Created:** 2026-02-03
**Status:** Complete

---

## Problem Statement

The chat experience was rated 3/10 primarily due to slow response times. Before the AI could start responding, the app was making multiple blocking network calls:

- Credit check (~100-300ms)
- Permission check (~200-500ms)
- Memory retrieval (~1-3 seconds) ← **Main bottleneck**
- Hybrid search (~500ms-1s)

**Total latency before AI starts:** 3-4 seconds

---

## Root Cause Analysis

### Memory Retrieval Was Wasteful

1. **Duplicate fetching** - Context was fetched twice:
   - Once in `doRetrieveContext()` → Railway backend
   - Again in `continueSendMessage()` → Supabase parallel fetch

2. **Always called, rarely useful** - For simple queries like "What time is it?", the full memory retrieval (embedding + vector search) added 1-3 seconds for no benefit.

3. **Expensive operations blocking every message:**
   - OpenAI embedding API call (~$0.00002 but 300-500ms latency)
   - Supabase queries for facts
   - Postgres vector search for semantic hits
   - Supabase queries for recent messages

---

## Solution: Memory as a Tool, Not Upfront Fetch

Instead of pre-loading context before every message, the AI should:
1. Always see basic user profile (name, preferences)
2. See full current conversation (not just 5 messages)
3. Use a `memory.search` tool IF it needs to look up past conversations

### Example Flow

**Before (wasteful):**
```
User: "What time is it?"
[Fetch facts, embeddings, semantic search] ← 1-3 seconds wasted
AI: "It's 2:30 PM"  ← Never used any of that context
```

**After (smart):**
```
User: "Is chocolate dangerous for Henry?"
AI sees: {name: "Colin", basic profile}
AI thinks: "Who is Henry? Let me check memory."
AI calls: memory.search("Henry")
Returns: "Henry is Colin's dog"
AI: "Yes, chocolate is toxic for dogs..."
```

If `memory.search` returns nothing, AI asks the user (Option A - don't guess).

---

## Implementation Progress

### ✅ Phase 1: Remove Blocking Memory Fetch (DONE)

**File:** `src/components/FloatBar/AppleFloatBar.jsx`

1. **Removed `doRetrieveContext()` call** (line ~2091)
   - Was calling `memoryAPI.query()` to Railway backend
   - Saved: ~1-3 seconds per message

2. **Removed `hybridSearchContext()` from parallel fetch** (line ~4276)
   - Was another embedding + vector search operation
   - Saved: ~500ms-1 second

3. **Simplified to local keyword search only**
   - Removed slow hybrid search path
   - Fast local keyword search still works

**Expected improvement:** 1.5-3 seconds faster per message

---

### ✅ Phase 2: Verify Conversation Context (DONE - Already Working)

**Original Problem:** Believed AI only sees last 5 messages, not full conversation.

**Investigation (2026-02-03):**

Traced the complete message flow from frontend to backend:

1. **Frontend (`AppleFloatBar.jsx` line 4059):**
   ```javascript
   recent_messages: thoughts.map((t) => ({ role: t.role, content: t.content }))
   ```
   ✅ ALL messages from `thoughts` array are sent (no `.slice()` limit)

2. **Backend (`/api/v2/runs` → `create_iterative_run`):**
   - Full `recent_messages` array passed to `IterativeRun`
   - Uses `build_conversation_context()` with dynamic token budgets

3. **Token Budget System (`context_budget_manager.py`):**
   - Total context window: 200,000 tokens
   - Conversation history gets 50% of flexible space (~90K tokens)
   - Max turns: 100 conversation turns supported
   - Works backwards from most recent messages, includes as many as fit

**What about the `.slice(-5)` I saw?**
- Line 4769: Only for beta analytics capture, NOT the actual AI context
- The real context uses full `thoughts` array

**What about the legacy V4 executor's 6-message limit?**
- `autonomous_executor_v4.py` line 418: `recent_messages[-6:]`
- This is for `/api/autonomous/execute` endpoint (legacy)
- Desktop app uses `/api/v2/runs` which uses iterative executor (no limit)

**Conclusion:** The full conversation context is ALREADY being sent and used correctly. The dynamic token budget system ensures the AI sees as much conversation as it can fit (up to 90K tokens).

**Remaining work for Phase 2:**
- For NEW conversations: Add summaries of last 3 conversations (Phase 5)
- The current conversation context is working correctly

---

### ✅ Phase 3: Add memory.search Tool + Fix Credits (DONE)

**Part A: memory.search Tool - ✅ DONE**

Implemented AI-callable memory tools in PullExecutor. When AI is uncertain about a reference (like "Henry"), it can call:
```json
{"action": "memory.search", "args": {"query": "Henry"}}
```

**Tools implemented:**
- `memory.search` - Semantic search through past conversations (calls `/api/memory/retrieval/query`)
- `memory.facts` - Get stored facts about the user (calls `/api/memory/facts`)
- `memory.recent` - Get recent conversation context (from local userContext)
- `memory.reflect` - Deep search combining search + facts when uncertain

**Files modified:**
- `electron/autonomous/pullExecutor.cjs` - Added `executeMemoryTool()` method

**AI Instructions:**
- Already included in prompts via `get_memory_tools_instruction()` in `prompt_builder.py`
- AI is instructed: "Instead of saying 'I don't know', USE THESE TOOLS FIRST"
- Enabled by default via `SELF_REFLECTION_ENABLED=1` environment variable

**Part B: Fix Credit System - ✅ DONE**

**What was already working:**
- Backend deducts credits via `finalize_billing()` → `accrue_tokens()` → Supabase RPC `deduct_credits_for_tokens`
- Credit check runs at message send time and blocks if 0 credits
- Supabase RPC function exists and handles atomic credit deduction (250 tokens = 1 credit)

**What was added:**
1. ✅ "No credits" overlay on input area when credits depleted
2. ✅ Credit check after task completion to detect depletion
3. ✅ "Purchase Credits" button in overlay to open settings

**Files modified:**
- `src/components/FloatBar/AppleFloatBar.jsx`:
  - Added `noCreditsState` state to track credit depletion
  - Added `checkCreditsAfterTask()` callback to check credits after task completion
  - Passed `noCreditsState` and `onPurchaseCredits` props to ComposerBar
  - Added credit check call after task completion (2 locations)
- `src/components/FloatBar/ComposerBar.jsx`:
  - Added `noCreditsState` and `onPurchaseCredits` props
  - Added overlay component that shows when credits are depleted

**How it works:**
1. User sends message → credit check at start (blocks if 0)
2. Task runs → backend accumulates tokens
3. Task completes → `finalize_billing()` deducts credits based on total tokens used
4. Frontend calls `checkCreditsAfterTask()` after completion
5. If credits <= 0, shows subtle overlay on input: "No credits remaining, resets {date}"
6. Overlay has "Purchase Credits" button to open settings

---

### ✅ Phase 4: Local SQLite Cache (DONE)

**Problem:** User profile/facts fetched from Supabase on every message.

**Solution:**
- Store user profile + facts locally in SQLite
- Sync to/from Supabase in background
- App reads from local (fast), writes to both

**Benefits:**
- Faster reads (no network latency)
- Works offline
- Backup if Supabase fails

---

### ✅ Phase 5: Conversation Summaries (DONE)

**Problem:** New conversations have no context about past interactions.

**Current (broken) behavior:**
- Backend hydrates up to 100 FULL messages from old sessions
- Wastes ~30,000 tokens per message on irrelevant history
- "New Conversation" doesn't actually clear due to session_id bug (see Critical Bug above)

**Desired behavior:**
- New conversation = fresh session_id = clean slate (NO old messages)
- Brief 2-3 sentence summaries of past conversations included
- Example: "In past conversations, Colin asked about Pixelmator, his dog Henry, and QuickBooks"
- Token usage: ~100 tokens instead of ~30,000 tokens

**Solution:**
1. **First: Fix the session_id bug** (see Critical Bug section)
2. When conversation ends, generate 2-3 sentence summary via LLM
3. Store last 3 summaries locally (SQLite)
4. On NEW conversation only, include summaries in context
5. Remove the `_hydrate_from_supabase` full-message loading for new sessions

**Token savings:** ~29,900 tokens per message = ~$0.09/message saved

---

## Related Issues Discovered

### ✅ FIXED: Session ID Mismatch (New Conversation Doesn't Work)

**Discovery Date:** 2026-02-03
**Fixed Date:** 2026-02-03

**Problem:** Clicking "New Conversation" did NOT actually start a fresh conversation. Old messages still got loaded.

**Root Cause:** Two different localStorage keys were used for session_id!

| Component | OLD Key | NEW Key (Fixed) |
|-----------|---------|-----------------|
| `AppleFloatBar.jsx` | `session_id` | `session_id` ✅ |
| `pullAutonomous.js` | `agent_max_session_id` ❌ | `session_id` ✅ |

**Fix Applied:**
1. ✅ Changed `pullAutonomous.js` to use unified `session_id` key
2. ✅ Updated `_getOrCreateSessionId()` method
3. ✅ Updated `clearSession()` method
4. ✅ Added migration to remove old `agent_max_session_id` key

**Files modified:**
- `src/services/pullAutonomous.js`

**Token Savings:** ~30,000 tokens per message when starting new conversations

**Tested:** 2026-02-03
- ✅ Sent message with secret code "BANANA-7742"
- ✅ Clicked "New Conversation"
- ✅ Asked "What is the secret password?"
- ✅ AI responded: "I couldn't find any information about a 'secret password'"
- ✅ Confirms session isolation is working correctly

---

### Credit System Not Working

**Current behavior:**
- Credit check runs but doesn't block long multi-step tasks
- Credits don't decrement after task completion

**Desired behavior:**
1. AI completes the full task sequence (don't stop mid-task)
2. After task ends, deduct credits based on actual token usage
3. If credits depleted, show overlay on input: "No more credits. Usage resets on {date}"
4. User cannot send more messages until credits reset or purchased

**Files involved:**
- `src/components/FloatBar/AppleFloatBar.jsx` - Credit check logic
- Backend - Credit deduction after completion
- Supabase - `users.credits` field

---

## Storage Architecture (Future)

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S MAC                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Local SQLite (PRIMARY for reads)               │   │
│  │  - User profile                                 │   │
│  │  - Facts (name, preferences, etc.)             │   │
│  │  - Conversation summaries                       │   │
│  │  - Current conversation (full)                  │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕ sync                          │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (CLOUD)                     │
│  - User profile (backup)                                │
│  - Facts (backup)                                       │
│  - Full conversation history                            │
│  - Embeddings for semantic search                       │
└─────────────────────────────────────────────────────────┘
```

---

## Testing Results

### Phase 1 Testing (2026-02-03)

**Test Environment:** Autonomous mode (PullExecutor)

| Test | Total Time | Notes |
|------|------------|-------|
| "Hello, how are you?" | 16.7s | AI response + backend processing |
| "Show my incomplete reminders" | 10.5s | SQLite query worked, faster tool execution |

**Observations:**
- ✅ `doRetrieveContext` calls removed (no "Searching memory" logs)
- ✅ `hybridSearchContext` calls removed (no embedding API calls)
- ✅ Reminders SQLite optimization working (reminders returned correctly)
- ✅ User profile still loads correctly
- ✅ No JavaScript errors in console
- ⚠️ Total time still 10-17s due to:
  - Autonomous mode uses PullExecutor (more backend round-trips)
  - AI thinking time on Anthropic (~3-5s)
  - Run creation on Railway backend (~2-3s)

**What was removed:**
- `memoryAPI.query()` call to Railway (was ~1-3s)
- `hybridSearchContext()` embedding call (was ~500ms-1s)
- Total frontend pre-processing savings: ~1.5-4 seconds

**Remaining bottlenecks (not in scope for Phase 1):**
- Autonomous mode run creation/orchestration
- AI model thinking time
- Backend tool execution loop

### Phase 1 Testing Checklist
- [x] Memory API calls removed from frontend
- [x] Hybrid search calls removed
- [x] User profile still loads
- [x] Facts still available
- [x] Tool execution (reminders) works
- [x] No console errors
- [ ] A/B comparison with production (need baseline)

### Phase 2 Analysis (2026-02-03)

**Finding:** Full conversation context ALREADY works correctly!

**Verified Flow:**
1. ✅ Frontend sends ALL `thoughts` as `recent_messages` (no slice limit)
2. ✅ Backend receives full array via `/api/v2/runs`
3. ✅ `create_iterative_run()` passes to `IterativeRun`
4. ✅ `decide_next_action()` uses `build_conversation_context()`
5. ✅ Token budget allocates ~90K tokens for conversation history
6. ✅ Messages included backwards from most recent (most relevant)

**Key Files Verified:**
- `AppleFloatBar.jsx:4059` - Sends all thoughts
- `runs.py:1903-1904` - Extracts recent_messages
- `iterative_executor.py:705-728` - Builds context with budget
- `context_budget_manager.py` - Allocates 50% of 181K to conversation

**The `.slice(-5)` at line 4769 is ONLY for beta analytics, not AI context.**

### Future Testing
- [x] Full conversation visible to AI (verified - already working)
- [x] memory.search tool works when AI calls it
- [x] Conversation summaries appear for new chats
- [x] Credits deduct correctly after task completion
- [x] "No credits" overlay appears when depleted

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/FloatBar/AppleFloatBar.jsx` | Removed doRetrieveContext call, removed hybridSearchContext, simplified to local search |

---

## Notes

- Query classification was considered but rejected (past attempts became too complex and misclassified)
- Memory-as-a-tool approach preferred over upfront fetch
- If memory.search returns nothing, AI should ask user (not guess)
- All conversations should be embedded for semantic search to work well
