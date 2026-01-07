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

## Priority 3: Mode Validation Centralized

### Problem
Mode checking (`chatty` vs `autonomous`) was duplicated across 256 files with inconsistent patterns:
- Three duplicate enum definitions
- Raw string comparisons (`mode == "chatty"`) everywhere
- No single source of truth

### Solution
Enhanced `permission_levels.py` as THE single source of truth with:
- String constants: `CHATTY`, `AUTONOMOUS`, `VALID_MODES`
- Helper functions: `is_chatty()`, `is_autonomous()`, `normalize_mode()`, `is_valid_mode()`, `to_permission_level()`
- Updated all critical files to import from `permission_levels`

### Status: COMPLETED

### Changes Made
1. **Enhanced `permission_levels.py`** (single source of truth):
   - Added string constants `CHATTY = "chatty"`, `AUTONOMOUS = "autonomous"`
   - Added `VALID_MODES` frozenset
   - Added `normalize_mode()` - validates and normalizes mode strings
   - Added `is_chatty()`, `is_autonomous()` - type-safe mode checks
   - Added `is_valid_mode()` - validation without default fallback
   - Added `to_permission_level()` - converts to enum
   - Simplified `get_permission_level_from_settings()` to use new helpers

2. **Updated `api/models/safety.py`**:
   - Imports constants from `permission_levels.py`
   - Uses `is_valid_mode()` in validator

3. **Updated core files** to use centralized imports:
   - `tool_definitions.py` - `is_chatty()` for tool selection
   - `response_router.py` - `is_autonomous()` for routing
   - `chat_pipeline.py` - `is_chatty()`, `is_autonomous()`
   - `unified_prompts.py` - `is_chatty()` for prompt selection
   - `denylist.py` - `normalize_mode()`, `is_chatty()`
   - `actions/policy.py` - `is_chatty()`, `is_autonomous()`

### Usage Pattern
```python
# OLD (fragile):
if mode == "chatty":
    ...

# NEW (centralized):
from agent_max.core.safety.permission_levels import is_chatty
if is_chatty(mode):
    ...
```

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
| 2026-01-06 | Mode validation centralization | COMPLETED | Enhanced permission_levels.py as single source of truth, updated 7 critical files |
