# Thought Trace UI (Inline Collapsible Bubble)

Updated: 2025-11-05

## Summary
Adds a live "Thought" bubble to the FloatBar chat UI that streams status/reasoning as events arrive from the backend (thinking/plan/step). The bubble is expanded during streaming, and automatically collapses after completion. Scope is the current conversation only; traces are not persisted across sessions in v1.

## UX Behavior
- Inline row labeled "Thought" with a lightbulb icon.
- **Only appears when backend sends thinking/plan/step events** (lazy creation).
- Expanded while the AI is streaming.
- Auto-collapses after `done`/`error`.
- **Auto-removed if empty** (no thinking events received).
- Collapsed view shows a compact chip with word count; click to expand.
- Content updates on these SSE event types: `thinking`, `plan`, `step`.
- Final assistant message renders separately as usual.

## Implementation Notes
- **Lazy creation**: Thought bubble is created on the first `thinking`/`plan`/`step` event, not on `ack`.
- Appended text via `appendThought()` on `thinking`/`plan`/`step`.
- Collapsed via `collapseCurrentThought()` on `done`/`error`.
- If bubble is empty when collapsing, it's removed entirely to prevent "0 words" UI artifacts.
- Scoped to `thoughts` state within `AppleFloatBar.jsx` only (no cross-session storage).
- No server changes required; uses existing SSE stream from `chatAPI.sendMessageStream`.

## Bug Fixes
**2025-11-05**: Fixed empty Thought bubble appearing for simple queries.
- **Issue**: Bubble was created on `ack` event, before backend sent any thinking content. For simple responses (e.g., "write a story"), backend doesn't emit thinking events, resulting in "0 words" bubble.
- **Fix**: Switched to lazy creation—bubble is only created when first thinking content arrives. Empty bubbles are removed on collapse.

## Files Changed
- src/components/FloatBar/AppleFloatBar.jsx
  - Added icon imports.
  - Added `thoughtIdRef`, `appendThought`, and `collapseCurrentThought` helpers.
  - Hooked into SSE handler to create/update/collapse Thought entries.
  - Rendered a new inline Thought bubble in the messages map.
- (Styles) Uses existing FloatBar styles; no new CSS file required.

## How to Use
1. Run the desktop app and send a prompt.
2. During streaming, a “Thought” bubble appears and updates live.
3. After the answer finishes, the Thought bubble collapses; click to re-expand.
4. Clearing the conversation clears the Thought entries.

## Testing

### Manual Testing
- **Live stream**: Send a multi-step task; confirm Thought updates per event.
- **Auto-collapse**: Verify after final response that the bubble collapses.
- **Re-expand**: Click the Thought chip to expand and review.
- **Conversation scope**: Start a new conversation (or clear); previous Thought bubbles do not appear.
- **No empty bubbles**: Send a simple query like "What is 2+2?" and verify NO Thought bubble appears.

### Automated Testing
Run the thought capture verification test:
```bash
node tests/e2e/thought_capture_test.mjs
```

This test validates:
- ✅ Thought bubble appears for complex reasoning tasks
- ✅ Thinking events are correctly captured and streamed
- ✅ Plan/step events are captured in autonomous mode
- ✅ NO Thought bubble for simple queries (control case)
- ✅ Content is properly accumulated across multiple events

Test cases include:
- Complex reasoning (multi-step math)
- Planning tasks
- Autonomous execution with tools
- Simple questions (should NOT show Thought)
- Creative tasks with explicit reasoning

## Follow-ups (Not in v1)
- Settings toggle to enable/disable Thought capture.
- Optional history view to browse Thought traces from prior conversations.
- Persist per-message trace metadata if backend/session model is expanded.
