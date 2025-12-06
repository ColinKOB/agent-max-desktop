# Agent Max Desktop — Codebase Overview

Updated: Nov 2025
 
Last Verified
- Date: 2025-11-04
- Environment: local dev (desktop)
- Unit tests: telemetry/electron broker passed
- API smoke: tests/api/smoke-v2.spec.js added (run via `npm run test:api`)

## Purpose
High-level map of the Electron + React desktop app, how it talks to the backend, and where core features live. Use this as your starting point; follow the links for deep dives.

## Top-Level Structure
- **src/** — React UI and client services
- **electron/** — Main process, IPC bridges, updater, vault, telemetry broker
- **docs/** — Comprehensive documentation index and deep dives
- **tests/** — Unit, integration, and Playwright tests
- **supabase/** — Local telemetry/dashboard schema (optional)

## Entry Points
- **electron/main.cjs** — Boots windows, IPC, telemetry, updater
- **src/main.jsx** — React bootstrap (HashRouter)
- **start_app.sh / npm run electron:dev** — Vite + Electron dev loop

## Runtime Wiring (Renderer ⇄ Main ⇄ Backend)
- **API client**: `src/services/api.js` wraps axios with retries, auth headers (`X-API-Key`, `X-User-Id`), and streaming fallbacks
- **Config**: `src/config/apiConfig.js` selects base URL and key (env > dev defaults > production)
- **Telemetry**: Renderer `src/services/telemetry.js` → IPC bridge `electron/preload.cjs` → broker `electron/telemetry.cjs` → backend `/api/telemetry/batch`
- **Memory Vault**: `electron/memory-vault.cjs`, `memory-manager*.cjs` provide secure local storage and migrations

## Core Services (src/services/api.js)
Each group calls stable `/api/v2/*` routes with sensible fallbacks:
- **profileAPI** — Profile, greeting, context, insights
- **factsAPI** — Fact extraction, get/set, summary
- **semanticAPI** — Similar goals, embeddings, patterns, cache stats
- **conversationAPI** — Add message/task, context, history by id
- **preferencesAPI** — Get/set/analyze preferences
- **chatAPI** —
  - `sendMessage` (non-stream autonomous)
  - `sendMessageStream` (SSE). Mode maps: `chatty`/`helpful` → chat stream, `autonomous` → autonomous stream. Fallback to JSON endpoint when streaming unavailable
- **googleAPI** — Status, Gmail, Calendar, YouTube, Sheets, Docs
- **telemetryAPI** — Batch, interactions, errors, stats
- **screenAPI** — Capabilities, info, status, click/type/scroll/screenshot
- **agentsAPI** — Provider/role lists, create/delegate/list/delete
- **creditsAPI** — Balance, packages, checkout/subscription, deduct, emergency top-up
- **permissionAPI** — Internal helper to try multiple paths per action

## Key UI Components
- **FloatBar and chat**: `src/components/FloatBar/*`, `App.jsx`
- **History**: `src/components/ChatHistory.jsx`, `ConversationHistory.jsx`
- **Screen Control**: `src/components/ScreenControl.jsx`
- **Google Connect**: `src/components/GoogleConnect.jsx`, setup page `src/pages/GoogleSetup.jsx`
- **Billing & Credits**: `src/components/billing/*`, `UsageDashboard.jsx`, `SubscriptionManager.jsx`
- **Settings**: `src/pages/Settings*.jsx`
- **Update Notice**: `src/components/UpdateNotification.jsx`

## Electron Main Process
- **telemetry.cjs** — Broker batches renderer events to backend
- **preload.cjs** — Safe IPC surface (telemetry, memory, openExternal, etc.)
- **updater.cjs** — Auto-updater plumbing (electron-builder)
- **memory-vault.cjs / migrate-to-vault.cjs** — Local encrypted storage + migrations
- **hands-on-desktop-client.cjs / localExecutor.cjs** — Policies for remote/local tool execution

## Feature Flags
- **src/config/featureFlags.js** — Glass UI and evolution-plan toggles
  - Master: `GLASS_UI_ENABLED`
  - Section toggles (e.g., `GLASS_SETTINGS`, `GLASS_PROFILE_CARD`)
  - Dev-only runtime flips when `MODE=development`

## Configuration & Environments
- Renderer env: `VITE_API_URL`, `VITE_API_KEY`, `VITE_ENVIRONMENT`
- Telemetry: `VITE_TELEMETRY_API`, `VITE_TELEMETRY_API_KEY` (+ Electron mirrors)
- Dev: auto-detects local backend at `http://localhost:8000/health`
- Prod: disallows localhost overrides; defaults to `https://api.agentmax.com` if unset

## Streaming Model (SSE)
- Chat stream endpoints: `/api/v2/chat/streaming/stream` (several fallback paths)
- Autonomous stream: `/api/v2/autonomous/execute/stream`
- Parser ignores non-JSON lines and handles `[DONE]`. Falls back to JSON chat when streaming fails

## Testing & Scripts
- Unit/Vitest (Electron bridges): `npm run test -- tests/unit/telemetryService.test.js tests/unit/electronTelemetry.test.js`
- Playwright configs: `playwright*.config.js`, `tests/e2e/*.js`
- Integration scripts: `scripts/integration/*`, `scripts/e2e_triage.mjs`

## Authoritative Docs
- docs index: `docs/README.md`
- Desktop brief: `agents.md`
- Connectivity: `docs/CONNECTIVITY_ROADMAP.md`
- Telemetry pipeline: `docs/TELEMETRY_PIPELINE.md`
- Backend integration: `docs/architecture/BACKEND_INTEGRATION_COMPLETE.md`
- Design & UX: `docs/design/UX_IMPROVEMENT_PLAN.md`

## Quick Start
```bash
npm install
npm run electron:dev
# In Settings, set API URL and API Key if not auto-detected
```

## Notes
- Protected routes require `X-API-Key`
- `src/services/api.js` logs slow requests and connection state, used by a reconnect pill in UI
- Renderer telemetry falls back to direct HTTP if the IPC bridge is unavailable
