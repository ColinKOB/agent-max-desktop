# Legacy Code Audit – Agent Max Desktop (2025-11-06)

This audit focused on locating deprecated/legacy code, dead code, and duplicate implementations; comparing “v2” API usage vs older counterparts; and assessing UX alignment. Findings are derived from searching src, electron, scripts, and tests.

## Summary
- Newer, actively used paths center around AppleFloatBar + services/api.js with v2 endpoints.
- Multiple legacy/test-only implementations remain in repo, not wired to production routes.
- Duplicated billing UIs exist (old simple vs newer comprehensive).
- A few stray/unreferenced files can be safely removed now.

---

## Safe to Delete Now (no references; will not break app)
- src/config/api.js
  - Superseded by src/config/apiConfig.js; no imports found.
- src/components/FloatBar/Untitled-1
  - Paste of external glass UI sample text; not referenced.
- electron/Untitled-1
  - One-line dumped JSON; not referenced.

Optional if you agree to clean prototypes:
- src/components/FloatBar/FloatBarCore.jsx
- src/components/FloatBar/FloatBarInput.jsx
- src/components/FloatBar/FloatBarMessages.jsx
- src/components/FloatBar/FloatBarHeader.jsx
- src/components/FloatBar/FloatBarActions.jsx
- src/components/FloatBar/useFloatBarState.js
- src/components/FloatBar/useMessageHandler.js
- src/services/conversationSummary.js
  - Rationale: This modularized FloatBar set is not routed in production (App uses AppleFloatBar). Only FloatBarCore imports useMessageHandler; conversationSummary.js is only used by useMessageHandler and hardcodes API_BASE_URL = 'http://localhost:8000'. AppleFloatBar implements richer SSE/plan/exec UX and is the default.

Note: if you want to keep the “conversation summary” feature, re-implement via apiConfigManager and high-UX integration in AppleFloatBar before deleting conversationSummary.js.

---

## Candidates to Archive (move to docs/archive/ or tests/) – test harnesses, not in app routes
- src/hooks/useAutonomous.js
- src/services/autonomousWebSocket.js
- src/components/AutonomousTest.jsx
- src/components/AutonomousProgress.jsx
- src/components/AutonomousStepCard.jsx
- src/pages/AutonomousTestPage.jsx
- src/autonomous-test-main.jsx

Rationale: These compose a WebSocket-based autonomous test harness. main.jsx does not route to AutonomousTestPage; docs reference a standalone test HTML under docs/archive. Production flows use services/api.js SSE endpoints, not this WS stack.

---

## Deprecate → Replace → Remove (needs small refactor)
- Duplicate Subscription UIs
  - Keep: src/components/billing/SubscriptionManager.jsx (integrated under BillingSettings)
  - Deprecate: src/components/SubscriptionManager.jsx (simple prototype)
  - Reason: SettingsApp route uses BillingSimple → old SubscriptionManager. Newer billing suite (components/billing/* incl. BillingSettings) offers better UX and v2 alignment.
  - Plan:
    1) Replace BillingSimple to render BillingSettings (or embed BillingSettings within SettingsApp).
    2) Update services/api.js subscriptionAPI to use v2 endpoints (see below).
    3) After verification, delete src/components/SubscriptionManager.jsx and src/pages/BillingSimple.jsx.

- Settings pages
  - In use: src/pages/SettingsApp.jsx (simple tabbed host for SettingsSimple/BillingSimple)
  - Unused prototypes: src/pages/Settings.jsx and src/pages/SettingsApp.enhanced.jsx
  - Recommendation: Consolidate to a single Settings surface. If moving forward with glass UI + comprehensive billing (BillingSettings), wire that into SettingsApp. Then archive or delete the unused Settings*.jsx variants.

---

## v2 vs Legacy Endpoint Notes
- services/api.js
  - Chat streaming uses v2 endpoints with controlled legacy fallbacks (disableLegacyFallbacks true in prod). Keep for now until backend parity is guaranteed.
  - subscriptionAPI uses `/api/subscription/*` (non-v2). Recommend migrating to `/api/v2/subscription/*` once backend supports it.
- services/memoryAPI.js
  - Retrieval uses `/api/v2/memory/retrieval/query` with fallback to legacy path.
  - Facts/messages apply/extract/stats use `/api/memory/*` legacy paths. If backend exposes v2 alternatives, migrate; otherwise keep (actively used by AppleFloatBar: query, extract, apply).
- conversation summary prototype
  - conversationSummary.js calls `/api/v2/conversation/summarize` but is not used by production UI. If we want this feature, integrate via AppleFloatBar, not FloatBarCore.

---

## Dead Code With Potentially Useful Features
- Conversation 5-word summary (services/conversationSummary.js)
  - Keep concept; re-implement using apiConfigManager and integrate into AppleFloatBar UI (e.g., quick “Copy summary” action) with proper auth headers.
- WebSocket autonomous test harness
  - Useful for experiments; recommend moving into tests/ or docs/ and updating to hit current `/api/v2/agent/execute/stream` SSE semantics instead of WS.

---

## Proposed Deletions Checklist
- Delete now:
  - src/config/api.js
  - src/components/FloatBar/Untitled-1
  - electron/Untitled-1
- Delete now (if we commit to AppleFloatBar-only):
  - src/components/FloatBar/FloatBarCore.jsx
  - src/components/FloatBar/FloatBarInput.jsx
  - src/components/FloatBar/FloatBarMessages.jsx
  - src/components/FloatBar/FloatBarHeader.jsx
  - src/components/FloatBar/FloatBarActions.jsx
  - src/components/FloatBar/useFloatBarState.js
  - src/components/FloatBar/useMessageHandler.js
  - src/services/conversationSummary.js
- Archive (tests):
  - src/hooks/useAutonomous.js
  - src/services/autonomousWebSocket.js
  - src/components/AutonomousTest.jsx
  - src/components/AutonomousProgress.jsx
  - src/components/AutonomousStepCard.jsx
  - src/pages/AutonomousTestPage.jsx
  - src/autonomous-test-main.jsx
- Deprecate (remove after refactor):
  - src/components/SubscriptionManager.jsx
  - src/pages/BillingSimple.jsx
  - src/pages/Settings.jsx
  - src/pages/SettingsApp.enhanced.jsx

---

## Next Steps
1) Approve safe deletions and run lint/build/tests.
2) Replace BillingSimple with BillingSettings in SettingsApp; migrate subscriptionAPI to v2.
3) Move autonomous WS harness into tests/ or docs/ and/or update it to SSE.
4) If adopting conversation summaries, integrate in AppleFloatBar using apiConfigManager (no hardcoded base URL).

Verification plan: run scripts/integration and tests/e2e suites; smoke the Settings → Billing tab and chat SSE flow.
