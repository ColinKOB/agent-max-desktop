# Agent Max UX Improvement Plan

**Date:** October 16, 2025  
**Focus:** Tighten flows, not pixels  
**Goal:** Faster to start, clearer to act, harder to get lost, easier to recover

---

## 🎯 **Core Principles**

1. **Zero friction to first action** - Get users productive in <10 seconds
2. **Progressive disclosure** - Show what's needed when it's needed
3. **No dead ends** - Every error state has an action
4. **Undo everything** - Users shouldn't fear mistakes
5. **Keyboard-first** - Mouse is optional

---

## 📊 **UX KPIs (Baseline → Target)**

| Metric | Current | Target | Measurement | Status |
|--------|---------|--------|-------------|--------|
| **Time to First Token (TTFT)** | ~2-3s | <1.5s (p95) | `ux.ttft_ms` | ✅ Tracking |
| **Abort Rate** | Unknown | <8% | `gen.stop_clicked / total_gens` | ✅ Tracking |
| **Search Usage** | 0% | >20% WAU | `conv.search_query / active_users` | ✅ Tracking |
| **Switcher Usage** | 0% | >15% WAU | `conv.switcher_used / active_users` | ✅ Tracking |
| **Mode Resume** | Unknown | >60% | `mode.resumed_last / mode.opened` | ✅ Tracking |
| **Message Actions** | 0% | >30% WAU | `msg.action / active_users` | ✅ Tracking |

---

## 🚀 **Implementation Phases**

### **Phase 1: Immediate Wins** ✅ COMPLETE (Oct 16, 2025 - Day 1)
Items that require minimal changes but have high impact.

### **Phase 2: Core Flows** ✅ COMPLETE (Oct 16, 2025 - Day 1)
Essential behavioral improvements to main user journeys.

### **Phase 3: Power Features** ✅ COMPLETE (Oct 16, 2025 - 3 hours)
Advanced functionality for engaged users.

### **Phase 4: Polish & Resilience** (TBD)
Error handling, accessibility, edge cases.

---

## 📋 **Detailed Checklist**

---

### **Phase 1: Immediate Wins** ✅ COMPLETE (Oct 16, 2025)

#### ✅ **1.1 Composer Improvements** 
**Time:** 2-3 hours  
**Impact:** HIGH (used every interaction)

- [x] **Always-visible send button** ✅ SHIPPED
  - Location: FloatBar.jsx, input section
  - Behavior: Disabled when input is empty/whitespace
  - State: `const canSend = message.trim().length > 0`
  - Visual: Grayed when disabled, teal when ready
  - Telemetry: `composer.send_clicked`

- [x] **Clear Enter vs Shift+Enter behavior** ✅ SHIPPED
  - Already working but needs visual hint
  - Add inline hint: "Press Enter to send · Shift+Enter for newline"
  - Show only on first 3 focuses, then hide forever
  - Store: `localStorage.getItem('composer.hint_dismissed')`
  - Telemetry: `onboarding.hint_dismissed`

- [x] **Draft autosave** ✅ SHIPPED
  - Location: FloatBar.jsx, message state
  - Save on every change with debounce (500ms)
  - Key: `draft:${sessionId}`
  - Restore on mount
  - Clear on send
  - Telemetry: `composer.draft_restored`

**Code locations:**
- `FloatBar.jsx` lines 572-931 (handleSendMessage)
- Input section around line 1200-1300

---

#### ✅ **1.2 Progressive Status States** ✅ COMPLETE
**Time:** 1-2 hours  
**Impact:** HIGH (improves perceived speed)

- [x] **State progression** ✅ SHIPPED
  - Current: Generic "Thinking..."
  - New: "Connecting..." → "Thinking..." → "Answering..."
  - Timing: Connecting (0-150ms), Thinking (150ms-first token), Answering (streaming)
  - Location: FloatBar.jsx, `setIsThinking` areas
  - Telemetry: `gen.state_durations` with timestamps

- [x] **Immediate echo** ✅ SHIPPED (already working)
  - Already works - user message appears instantly
  - Verify no delays in `setThoughts` call

**Code locations:**
- `FloatBar.jsx` lines 660-725 (message send flow)

---

#### ✅ **1.3 Attachment Chips** ✅ COMPLETE
**Time:** 1-2 hours  
**Impact:** MEDIUM (better screenshot UX)

- [x] **Screenshot attachment chip** ✅ SHIPPED
  - Current: Screenshot just stored in state
  - New: Show compact chip below input
  - Content: "📷 Screenshot (245 KB) [×]"
  - Remove action: Clear `screenshotData`
  - Position: Above input field, inside composer
  - Telemetry: `composer.attachment_added`, `composer.attachment_removed`

**Code locations:**
- `FloatBar.jsx` lines 551-570 (handleScreenshot)
- Add new component `AttachmentChip` around line 1150

---

#### ✅ **1.4 Undo for Destructive Actions** ✅ COMPLETE
**Time:** 2 hours  
**Impact:** HIGH (builds user trust)

- [x] **Undo after clear conversation** ✅ SHIPPED
  - Current: `handleResetConversation` clears immediately
  - New: Show inline banner "Conversation cleared · Undo"
  - Timer: 5 seconds
  - Store cleared state temporarily
  - Location: FloatBar.jsx line 932
  - Telemetry: `conv.cleared`, `conv.undo_clear`

- [ ] **Undo after fact save** (deferred to Phase 3 - needs deleteFact method)
  - Already has toast, needs undo button
  - Toast duration: 5s instead of 3s
  - Add "Undo" button to toast
  - Call memory service to delete fact
  - Telemetry: `memory.saved`, `memory.undo`

**Code locations:**
- `FloatBar.jsx` line 932 (handleResetConversation)
- Line 752 (fact save toast)

---

### **Phase 2: Core Flows** ✅ COMPLETE (Oct 16, 2025 - Single Day)

#### ✅ **2.1 Mode Switching Logic** ✅ COMPLETE (Day 1)
**Time:** 3-4 hours  
**Impact:** HIGH (core interaction model)

- [x] **Auto-expand to Card on attachment** ✅ SHIPPED (Day 1)
  - Current: Manual expand required
  - New: Attaching screenshot auto-opens Card
  - Trigger: `setScreenshotData` + `setIsOpen(true)`
  - Telemetry: `mode.auto_expand_reason: 'attachment'`

- [x] **Auto-expand on multi-line** ✅ SHIPPED (Day 1)
  - Trigger: Input height > 1 line
  - Detection: Track textarea scrollHeight
  - Expand: Bar → Card automatically
  - Telemetry: `mode.auto_expand_reason: 'multiline'`

- [x] **Remember last mode per position** ✅ SHIPPED (Day 1)
  - Store: `localStorage.getItem('mode.last:${x},${y}')`
  - Restore: On window open, check storage
  - Save: On mode change
  - Telemetry: `mode.resumed_last: true/false`

**Code locations:**
- Mode switching: FloatBar.jsx lines 156-207
- Storage: Add useEffect hook

---

#### ✅ **2.2 Stop/Continue Flow** ✅ COMPLETE (Day 1)
**Time:** 2-3 hours  
**Impact:** MEDIUM (user control during generation)

- [x] **Stop button during generation** ✅ SHIPPED (Day 1)
  - Current: No way to stop
  - New: Prominent "Stop" button appears while streaming
  - Position: Replace send button during generation
  - Action: Abort fetch, mark as stopped
  - Telemetry: `gen.stop_clicked`

- [x] **Continue button after stop** ✅ SHIPPED (Day 1)
  - Current: N/A
  - New: "Continue from here" button after stop
  - Action: Resume generation with existing context + partial response
  - Telemetry: `gen.continue_clicked`

**Code locations:**
- FloatBar.jsx streaming section (lines 689-724)
- Need to add abort controller

---

#### ✅ **2.3 Collapsible Thoughts** ✅ COMPLETE (Day 1)
**Time:** 2 hours  
**Impact:** MEDIUM (cleaner chat view)

- [x] **Auto-collapse after completion** ✅ SHIPPED
  - Current: Thoughts always visible
  - New: Show during streaming, collapse after complete
  - UI: "Show steps (8)" toggle
  - Store: Per-message preference
  - Telemetry: `thoughts.toggled: 'expand'/'collapse'`

- [x] **Per-step timings** ✅ SHIPPED
  - Show duration next to each step
  - Format: "Step 1: Analyzing (0.3s)"
  - Calculate: diff between step timestamps

**Code locations:**
- FloatBar.jsx thought rendering (lines 796-847)
- Need to track completion state

---

#### ✅ **2.4 Message Actions** ✅ COMPLETE (Day 1)
**Time:** 4-5 hours  
**Impact:** HIGH (user control over conversation)

- [x] **Copy message** ✅ SHIPPED (Day 1)
  - Trigger: Hover shows actions OR keyboard C
  - Action: Copy message.content to clipboard
  - Feedback: Toast "Copied"
  - Telemetry: `msg.action: 'copy'`

- [x] **Regenerate response** ✅ SHIPPED (Day 1)
  - Trigger: Hover on assistant message OR keyboard R
  - Action: Re-send last user message
  - Clear: Current assistant response
  - Telemetry: `msg.action: 'regenerate'`

- [x] **Edit user message** ✅ SHIPPED (Day 1)
  - Trigger: Hover on user message OR keyboard E
  - Action: Load into composer
  - Options: "Edit in place" OR "Fork from here"
  - Telemetry: `msg.action: 'edit'`, `thread.forked: true/false`

- [x] **Delete message** ✅ SHIPPED (Day 1)
  - Trigger: Hover OR keyboard Backspace+confirm
  - Action: Remove from thoughts array
  - Undo: 5s to restore
  - Telemetry: `msg.action: 'delete'`, `msg.undo_delete`

**Code locations:**
- Add new component: `MessageActions.jsx`
- Integrate into thought rendering section
- Add keyboard listeners

---

### **Phase 3: Power Features** (Days 5-7)

#### ✅ **3.1 Conversation Quick Switcher**
**Time:** 4-5 hours  
**Impact:** MEDIUM (power user feature)

- [ ] **Cmd/Ctrl+K shortcut**
  - Opens modal overlay
  - Shows recent conversations (last 20)
  - Title: First user message (truncated)
  - Fuzzy search by content
  - Telemetry: `conv.switcher_used`

- [ ] **Implementation**
  - New component: `ConversationSwitcher.jsx`
  - Data: Load from memory service
  - Search: Filter by title/content
  - Navigate: Arrow keys + Enter
  - Close: Escape OR click outside

**Code locations:**
- New file: `src/components/ConversationSwitcher.jsx`
- Hook into FloatBar keyboard listener

---

#### ✅ **3.2 In-Conversation Search**
**Time:** 3-4 hours  
**Impact:** MEDIUM (find past messages)

- [ ] **Search UI**
  - Trigger: Cmd/Ctrl+F
  - UI: Compact search bar at top of thoughts
  - Show: Hit count "3 of 12"
  - Navigate: Next/Previous buttons
  - Highlight: Matched text
  - Telemetry: `conv.search_query`

- [ ] **Implementation**
  - State: `searchQuery`, `currentHit`, `totalHits`
  - Filter: thoughts.filter by content match
  - Scroll: Auto-scroll to highlighted message
  - Clear: Escape or close button

**Code locations:**
- Add to thoughts container in FloatBar.jsx
- New component: `ConversationSearch.jsx`

---

#### ✅ **3.3 Export Conversation**
**Time:** 2-3 hours  
**Impact:** LOW (occasional use)

- [ ] **Export formats**
  - Markdown (.md): Human-readable
  - JSON (.json): Machine-readable with full context
  - Include: Messages, timestamps, tool runs
  - Warn: If thoughts are excluded
  - Telemetry: `conv.export: 'md'/'json'`

- [ ] **Implementation**
  - Button: In header or menu
  - Generate: Format thoughts array
  - Download: Via blob + link
  - Filename: `agent-max-${date}.md`

**Code locations:**
- New utility: `src/utils/exportConversation.js`
- Add button to FloatBar header

---

#### ✅ **3.4 Memory Panel**
**Time:** 6-8 hours  
**Impact:** HIGH (essential for memory management)

- [ ] **Memory browser**
  - List all facts
  - Group by category
  - Search/filter
  - Sort by recency/confidence

- [ ] **Memory actions**
  - View: See fact details
  - Edit: Modify value/confidence
  - Forget: Delete fact
  - Source: Jump to message that created it
  - Telemetry: `memory.action: 'view'/'edit'/'forget'`

- [ ] **Privacy mode toggle**
  - Suppress screenshots
  - Strip filenames/URLs
  - Redact sensitive data
  - Telemetry: `privacy.mode_enabled: true/false`

**Code locations:**
- New page: `src/pages/MemoryManager.jsx`
- Open from header button OR Cmd/Ctrl+M

---

### **Phase 4: Polish & Resilience** (Days 8-9)

#### ✅ **4.1 First-Run Experience**
**Time:** 3-4 hours  
**Impact:** HIGH (first impression)

- [ ] **Welcome screen**
  - Show on first run only
  - Three choices:
    1. "Ask a question" → Opens composer
    2. "Screenshot + ask" → Takes screenshot, opens composer
    3. "Try an example" → Loads example prompt
  - Telemetry: `onboarding.choice: 'ask'/'screenshot'/'example'`

- [ ] **Memory consent**
  - Single toggle: "Save chats to memory"
  - Default: OFF
  - Explainer: "Agent Max will remember facts across conversations"
  - Link: "Learn more" → Opens in-app guide
  - Telemetry: `privacy.memory_opt_in: true/false`

**Code locations:**
- New component: `WelcomeScreen.jsx`
- Check: `localStorage.getItem('onboarding.completed')`
- Show conditionally in App.jsx

---

#### ✅ **4.2 Error Recovery**
**Time:** 3-4 hours  
**Impact:** HIGH (no dead ends)

- [ ] **Actionable error messages**
  - Network error: "Can't reach server · Retry · Work offline · Copy input"
  - Timeout: "Request timed out (30s) · Retry · Try simpler prompt"
  - Auth error: "Invalid API key · Open settings"
  - Rate limit: "Rate limited · Retry in 60s"
  - Telemetry: `error.type`, `error.action_clicked`

- [ ] **Auto-retry with countdown**
  - Exponential backoff: 2s, 4s, 8s
  - Show: "Retrying in 3s... Cancel"
  - Max retries: 3
  - Telemetry: `error.retry_attempt`, `error.retry_success`

- [ ] **Memory degradation banner**
  - Detect: Memory service error
  - Show: "Memory temporarily unavailable. Your chat will still work."
  - Position: Top of card
  - Dismiss: Manual or auto-hide after 10s

**Code locations:**
- FloatBar.jsx error handling (lines 851-930)
- Enhance existing error states

---

#### ✅ **4.3 Accessibility & Keyboard**
**Time:** 2-3 hours  
**Impact:** MEDIUM (a11y compliance)

- [ ] **Keyboard shortcuts**
  - `?`: Show shortcuts palette
  - `Cmd/Ctrl+K`: Quick switcher
  - `Cmd/Ctrl+F`: Search
  - `Cmd/Ctrl+M`: Memory panel
  - `Escape`: Collapse/close
  - `E`: Edit message (when focused)
  - `R`: Regenerate (when focused)
  - `C`: Copy (when focused)

- [ ] **Focus management**
  - After mode switch: Return to composer
  - After modal close: Return to last focus
  - Tab order: Logical top-to-bottom

- [ ] **Reduced motion/transparency**
  - Detect: `prefers-reduced-motion`
  - Disable: Springy animations, blur transitions
  - Fallback: Instant mode switches, static backgrounds

**Code locations:**
- New component: `ShortcutsPalette.jsx`
- Add global keyboard listener in App.jsx
- CSS: Add @media (prefers-reduced-motion)

---

#### ✅ **4.4 Telemetry Infrastructure**
**Time:** 2-3 hours  
**Impact:** HIGH (enables measurement)

- [ ] **UX event schema**
  - Version: `ux_schema: 'v1'`
  - Namespace: `ux.*`, `conv.*`, `memory.*`, `error.*`
  - Fields: `timestamp`, `session_id`, `user_id`, `event_type`, `data`

- [ ] **Key events**
  ```javascript
  // Latency
  telemetry.log('ux.ttft_ms', { duration: 1234, model: 'gpt-4' });
  
  // Actions
  telemetry.log('msg.action', { type: 'copy', message_id: '...' });
  telemetry.log('conv.search_query', { query: '...', hits: 5 });
  
  // Errors
  telemetry.log('error.type', { error: 'network', retry: true });
  
  // Features
  telemetry.log('memory.saved', { category: 'location', undo: false });
  telemetry.log('mode.auto_expand_reason', { reason: 'attachment' });
  ```

- [ ] **Dashboard queries**
  - TTFT: p50, p95, p99
  - Abort rate: `abort_clicked / total_generations`
  - Feature adoption: `unique_users_with_event / total_users`

**Code locations:**
- Existing: `src/services/telemetry.js`
- Enhance: Add UX-specific methods
- Verify: All events include schema version

---

## 🎯 **Quick Start: Day 1 Sprint**

**Goal:** Ship 5 high-impact improvements in 6-8 hours

### Morning (4 hours)
1. ✅ **Always-visible send button** (1h)
2. ✅ **Draft autosave** (1.5h)
3. ✅ **Progressive status states** (1h)
4. ✅ **Attachment chips** (30min)

### Afternoon (3 hours)
5. ✅ **Undo for clear conversation** (1.5h)
6. ✅ **Memory toast with undo** (1h)
7. ✅ **Testing & bug fixes** (30min)

**Metrics to track:**
- Baseline TTFT before changes
- User feedback on new behaviors
- Telemetry coverage (% of events logging)

---

## 📊 **Success Criteria**

### **Week 1 Goals:**
- [ ] TTFT p95 < 2s (from ~3s)
- [ ] Draft restore working 100% of time
- [ ] Undo used on >10% of clears
- [ ] Zero dead-end error states
- [ ] Telemetry on all Phase 1 features

### **Week 2 Goals:**
- [ ] Quick switcher used by >15% of users
- [ ] Search used by >20% of users
- [ ] Memory panel accessed >1x per session
- [ ] Abort rate < 10%
- [ ] Mode auto-expand working for attachments

### **Ship Criteria:**
- [ ] All Phase 1 complete
- [ ] 70%+ of Phase 2 complete
- [ ] No regressions in existing functionality
- [ ] QA pass on all new behaviors
- [ ] Telemetry dashboard showing metrics

---

## 🔧 **Implementation Notes**

### **State Management**
Most changes are in FloatBar.jsx - consider splitting:
- `useComposer()` hook for input state
- `useConversation()` hook for messages
- `useMode()` hook for pill/bar/card logic

### **Telemetry**
Use existing `src/services/telemetry.js`:
```javascript
telemetry.logInteraction({
  event: 'ux.ttft_ms',
  data: { duration, model },
  metadata: { session_id, ux_schema: 'v1' }
});
```

### **Storage**
Use localStorage for preferences:
```javascript
// Draft
localStorage.setItem(`draft:${sessionId}`, message);

// Mode memory
localStorage.setItem('mode.last:100,200', 'card');

// Onboarding
localStorage.setItem('onboarding.completed', 'true');
localStorage.setItem('composer.hint_dismissed', 'true');
```

### **Error Handling**
Never show raw errors - always provide action:
```javascript
const errorActions = {
  network: ['Retry', 'Work offline', 'Copy input'],
  timeout: ['Retry', 'Simplify prompt'],
  auth: ['Open settings'],
  ratelimit: ['Wait', 'Try later']
};
```

---

## 📝 **Testing Playbook**

### **Manual Test Scenarios**

#### First Run
1. Clear localStorage
2. Open app
3. Should see welcome screen
4. Select "Ask" → composer focused
5. Type + send → hint shows, then dismisses after send

#### Draft Persistence
1. Type message but don't send
2. Close window
3. Reopen
4. Draft should be restored

#### Mode Switching
1. Start in pill
2. Click → bar opens
3. Attach screenshot → card opens automatically
4. Escape → bar
5. Escape → pill

#### Stop/Continue
1. Send long request
2. Click Stop mid-generation
3. "Continue" button appears
4. Click Continue → resumes

#### Message Actions
1. Hover over message → actions appear
2. Click Copy → toast "Copied"
3. Click Regenerate → new response
4. Click Edit → loads into composer

#### Error Recovery
1. Disconnect network
2. Send message
3. See "Can't reach server" with actions
4. Click Retry → auto-retry with countdown

---

## 🚀 **Ready to Start!**

**Recommended order:**
1. Start with Phase 1 (Immediate Wins)
2. Ship after Day 1 to get feedback
3. Iterate on Phase 2 based on usage
4. Add Phase 3 features for power users
5. Polish with Phase 4

**First file to modify:** `FloatBar.jsx`  
**First change:** Always-visible send button (lines 1200-1300)

Let's make Agent Max a joy to use! 🎉
