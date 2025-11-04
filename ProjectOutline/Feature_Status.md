# Agent Max Desktop — Feature Status Snapshot

Updated: Nov 2025
 
Last Verified
- Date: 2025-11-04
- Environment: local dev (desktop)
- Unit tests: telemetry/electron broker passed
- API smoke: tests/api/smoke-v2.spec.js added (run via `npm run test:api`)

## Summary
- Frontend (Electron + React) is feature-rich and wired to the backend via `src/services/api.js` with streaming fallbacks.
- Production connectivity is documented and mostly green; a few routes may require re-verification after deploys.
- Telemetry is integrated (renderer + Electron broker) with an opt-in switch; backend expects `/api/telemetry/batch`.
- Memory Vault and history flows exist; UI display needs periodic verification against the latest backend.

See authoritative references:
- Connectivity: `docs/CONNECTIVITY_ROADMAP.md`
- Desktop brief: `agents.md`
- Docs index: `docs/README.md`

## Connectivity Status (Frontend ↔ Backend)
- Production URL: see `docs/CONNECTIVITY_ROADMAP.md` for current target and curl script.
- Headers: protected routes require `X-API-Key`; renderer also sends `X-User-Id` when present.
- Dev auto-detect: in non-prod builds, the app probes `http://localhost:8000/health` and switches automatically.

Verification (excerpt):
```sh
# Replace API_URL and API_KEY
curl -sS "$API_URL/health"
curl -sS "$API_URL/api/memory/health"
curl -sS -H "X-API-Key: $API_KEY" "$API_URL/api/v2/screen/status"
```
Full checklist: `docs/CONNECTIVITY_ROADMAP.md`.

## Feature Matrix
- **Chat + Autonomous (streaming)**
  - Status: Working (code-integrated). SSE with fallbacks to JSON.
  - Endpoints: `/api/v2/chat/streaming/stream`, `/api/v2/autonomous/execute/stream`.
  - Key files: `src/services/api.js (chatAPI)`, `src/components/FloatBar/*`.
  - Verify: send a prompt in Helpful/Autonomous; observe token stream and plan/step events.

- **Google Integration (Gmail/Calendar/Docs/Sheets/YouTube)**
  - Status: Working; reverify OAuth start/status after backend changes.
  - Endpoints: `/api/v2/google/*` (auth start/url/status, messages, calendar, youtube, docs, sheets).
  - Key files: `src/components/GoogleConnect.jsx`, `src/services/api.js (googleAPI)`, page `src/pages/GoogleSetup.jsx`.
  - Verify: Connect → poll status → test Gmail/Calendar/YouTube buttons. Check `localStorage.google_user_email`.

- **Screen Control**
  - Status: Integrated; availability depends on backend host capabilities.
  - Endpoints: `/api/v2/screen/*` (capabilities, click, type, scroll, screenshot).
  - Key files: `src/components/ScreenControl.jsx`, `src/services/api.js (screenAPI)`.
  - Verify: Capabilities + Status; try screenshot or click in a safe environment.

- **Telemetry**
  - Status: Partially integrated end-to-end (renderer service + Electron broker).
  - Endpoints: `/api/telemetry/batch`, `/api/v2/telemetry/*` (stats/interactions).
  - Key files: `src/services/telemetry.js`, `electron/telemetry.cjs`.
  - Verify: enable telemetry → trigger interactions → confirm on backend interactions/stats.

- **Memory Vault & Conversation History**
  - Status: Local encrypted vault + history APIs implemented; UI list requires periodic verification.
  - Key files: `electron/memory-vault.cjs`, `electron/migrate-to-vault.cjs`, `src/components/ChatHistory.jsx`, `src/components/ConversationHistory.jsx`, `src/services/api.js (conversationAPI)`.
  - Verify: create/send chats → check history UI and vault logs; hit `/api/v2/conversation/history`.

- **Billing & Credits**
  - Status: Integrated on client; requires live Stripe/backend config for end-to-end.
  - Endpoints: `/api/v2/credits/*`, `/api/subscription/*`.
  - Key files: `src/components/billing/*`, `SubscriptionManager.jsx`, `UsageDashboard.jsx`, `src/services/api.js (creditsAPI, subscriptionAPI)`.
  - Verify: fetch balance/packages; create checkout/portal in a test environment.

- **Feature Flags & Glass UI**
  - Status: Config-driven; dev runtime toggles available.
  - Key files: `src/config/featureFlags.js`.
  - Verify: flip flags in dev; confirm classnames/styles apply.

- **Auto-Updater**
  - Status: Wired; requires packaging pipeline and signing to validate fully.
  - Key files: `electron/updater.cjs`, `electron-builder.json`.
  - Verify: build artifacts and GitHub release flow.

## Known Gaps / Watchouts
- Telemetry config drift: ensure backend exposes `/api/telemetry/batch` with `ENABLE_TELEMETRY` and matching keys.
- Route drift: some `/api/v2/*` vs legacy paths; clients include robust fallbacks but re-verify after backend changes.
- Data duplication: prefer backend as single source of truth (see `docs/AGENT_MAX_INTEGRATION_ANALYSIS.md`).

## Suggested E2E Verification
- Frontend smoke: Playwright tests under `tests/e2e`, integration scripts in `scripts/integration/*`.
- Manual: Settings → set API URL/key → Test Connection → send message → try streaming/plan events.
- Google: Connect via `GoogleConnect` → poll status → exercise Gmail/Calendar.
- Telemetry: enable → exercise UI → check `/api/v2/telemetry/*`.

## Where to Go Deeper
- Architecture: `docs/architecture/*` (cache, memory vault, backend integration)
- Design/UX: `docs/design/*` and `UserInterfaceMarkdowns/`
- Desktop brief for newcomers: `agents.md`
