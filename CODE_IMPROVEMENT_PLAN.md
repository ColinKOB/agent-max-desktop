# Code Improvement Plan

## Overview
This document tracks code quality improvements identified through deep analysis of the Agent Max codebase.

---

## Priority 1: CHATTY_TOOLS Fragile Array Indices (CURRENT)

### Problem
```python
CHATTY_TOOLS = [
    CORE_TOOLS[0],  # think
    WEB_TOOLS[2],   # browser (simple search)
    UI_TOOLS[0],    # show_options
    UI_TOOLS[1],    # comparison_table
]
```
If anyone reorders `CORE_TOOLS`, `WEB_TOOLS`, or `UI_TOOLS`, chatty mode silently gets the wrong tools.

### Solution
Create a `get_tool_by_name()` helper and reference tools by name instead of index.

### Status: COMPLETED

### Changes Made
- Added `get_tool_by_name()` helper function at line 38-55
- Created `_build_chatty_tools()` function that uses name-based lookup
- Replaced fragile `CHATTY_TOOLS = [CORE_TOOLS[0], WEB_TOOLS[2], ...]` with safe name-based construction
- Verified fix works: `CHATTY_TOOLS` correctly contains `['think', 'browser', 'show_options', 'comparison_table']`

---

## Priority 2: AppleFloatBar.jsx Monolith (7,308 lines)

### Problem
Single React component with 7,308 lines is difficult to maintain, test, and debug.

### Recommended Split
```
AppleFloatBar/
├── index.jsx (main orchestrator, ~500 lines)
├── hooks/
│   ├── useSSEConnection.js
│   ├── useMessageHistory.js
│   ├── useAIOptions.js
│   └── useModeToggle.js
├── components/
│   ├── MessageBubble.jsx
│   ├── ThinkingIndicator.jsx
│   ├── WorkspacePanel.jsx
│   └── HeaderBar.jsx
└── utils/
    ├── sseEventHandlers.js
    └── messageFormatters.js
```

### Status: NOT STARTED

---

## Priority 3: Mode Validation Scattered Across 25+ Files

### Problem
Mode checking (`chatty` vs `autonomous`) is duplicated across 256 files with inconsistent patterns.

### Solution
- Backend: Use only `permission_levels.py` with `PermissionLevel` enum
- Frontend: Use only `PermissionContext`

### Status: NOT STARTED

---

## Priority 4: iterative_executor.py Complexity (1,509 lines)

### Problem
- Duplicate action detection logic embedded in main flow
- Multiple nested try/except blocks
- JSON parsing scattered throughout

### Solution
Extract to separate modules:
- `action_deduplicator.py`
- `response_parser.py`
- `step_recorder.py`

### Status: NOT STARTED

---

## Priority 5: Limited Frontend Test Coverage

### Problem
Only 6 test files for entire frontend. Critical gaps:
- AppleFloatBar.jsx - No unit tests
- SSE event handling - No mock tests
- Mode switching - No E2E tests

### Status: NOT STARTED

---

## Priority 6: No TypeScript on Frontend

### Problem
All `.jsx` files rely on runtime for type safety. Risk areas:
- SSE event payload shapes
- Mode value strings
- Props passed through components

### Status: NOT STARTED

---

## Progress Log

| Date | Item | Status | Notes |
|------|------|--------|-------|
| 2026-01-06 | CHATTY_TOOLS fix | COMPLETED | Added get_tool_by_name() helper, refactored CHATTY_TOOLS to use name-based lookup |
