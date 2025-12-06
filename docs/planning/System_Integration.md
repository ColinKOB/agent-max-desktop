# Agent Max Desktop + Agent_Max Backend — System Integration

Updated: Nov 2025
 
Last Verified
- Date: 2025-11-04
- Environment: local dev (desktop) targeting production backend
- Notes: API v2 smoke tests available via `npm run test:api` with `API_URL` and optional `TEST_API_KEY`

## Purpose
How the Electron/React desktop client and the FastAPI backend (Agent_Max) interact in production (Railway) and development. Includes request flows, headers, streaming, telemetry, Google OAuth, and verification.

## Responsibilities
- **Desktop (agent-max-desktop)**
  - UI/UX (FloatBar, history, settings, billing, Google connect, screen control UI)
  - HTTP client with retries, SSE parsing, path fallbacks
  - IPC bridges (telemetry, memory vault, updater)
- **Backend (Agent_Max on Railway)**
  - Authoritative APIs (`/api/v2/*`) for chat, autonomous tools, memory, facts, semantic, preferences
  - Google, screen-control, telemetry ingestion, billing/credits
  - Health and diagnostics

## Configuration & Auth Handshake
- **Base URL**: Chosen by `src/config/apiConfig.js`
  - Dev: probes `http://localhost:8000/health` and switches automatically
  - Prod: ignores localhost overrides and defaults to `https://api.agentmax.com` (or env `VITE_API_URL`)
- **Headers** (added by `src/services/api.js`):
  - `X-API-Key` for protected routes (from settings/env)
  - `X-User-Id` optional for personalization/analytics
- **Health checks**: `GET /health`, `GET /api/memory/health`

## Core Interaction Flows

### 1) Chat (Helpful/Chatty) — SSE
- Endpoint priority (desktop tries in order):
  - `POST /api/v2/chat/streaming/stream`
  - Fall back to legacy paths when 404/405 (`/api/chat/streaming/stream`, `/api/v2/chat/stream`, etc.)
- Payload: `{ message, context, max_tokens, temperature, stream: true, mode }`
- SSE parsing: ignores non-JSON lines and `[DONE]`, processes JSON objects line-by-line.
- Fallback: if all streaming paths fail, desktop posts JSON to `/api/v2/chat/message` and returns a final response.

### 2) Autonomous (Tool-Executing) — SSE with typed events
- Endpoint priority: `POST /api/v2/autonomous/execute/stream` (with fallbacks)
- Payload: `{ goal, mode: 'autonomous', user_context, image?, max_steps, timeout }`
- Event types handled by desktop:
  - `plan` → show execution plan
  - `thinking` → interim reasoning/step context
  - `step` → update thinking; optional `result` streamed as tokens
  - `done` → emits `final_response`
  - `error` → propagate error message

### 3) Google OAuth
- Desktop opens system browser to start the flow:
  - Prefers `GET /api/v2/google/auth/url` (server returns an `auth_url`)
  - Fallback to `GET /api/v2/google/auth/start`
  - Includes `user_id`, generated `device_id`, and optional encoded `state`
- Desktop polls `GET /api/v2/google/status` (no email) to detect completion, then caches `google_user_email`.
- Service tests use:
  - Gmail: `GET /api/v2/google/messages?email=<email>&max_results=1`
  - Calendar: `GET /api/v2/google/calendar/events?email=<email>&max_results=1`
  - YouTube: `GET /api/v2/google/youtube/search?q=test&max_results=1`

### 4) Screen Control
- Capabilities: `GET /api/v2/screen/capabilities`, `GET /api/v2/screen/status`
- Actions: `POST /api/v2/screen/click`, `/type`, `/scroll`, `/screenshot`, etc.
- Note: Availability depends on backend host capabilities; production servers may report unavailable.

### 5) Conversation & Memory
- Context: `GET /api/v2/conversation/context`
- History: `GET /api/v2/conversation/history`, `GET /api/v2/conversation/history/{id}`
- Local encrypted storage: Electron memory vault (`electron/memory-vault.cjs`, `migrate-to-vault.cjs`)
- Guiding principle: backend is the single source of truth; desktop caches for UX.

## Telemetry Pipeline
- Renderer (`src/services/telemetry.js`) batches events
  - If IPC bridge is available: send to Electron broker (`electron/telemetry.cjs`)
  - Else: direct HTTP fallback
- Backend ingestion:
  - Legacy batch: `PUT /api/telemetry/batch` (requires API key)
  - Stats & queries: `GET /api/v2/telemetry/stats`, `GET /api/v2/telemetry/interactions`
- Enable with environment and `ENABLE_TELEMETRY=1` server-side.

## Error Handling & Resilience
- `axios-retry` with exponential backoff on network/5xx
- Centralized error parsing and connection-state notifications (reconnect pill)
- Path fallbacks for most feature groups (permissionAPI `_tryPaths`)
- Streaming → JSON fallback for chat when SSE endpoints unavailable

## E2E Verification (Suggested)
1. Settings
   - Set API URL and API key, save, test connection
2. Chat/Autonomous
   - Send a prompt in Helpful (SSE) and Autonomous (plan/step/done events)
3. Google
   - Connect via `GoogleConnect` → poll → test Gmail/Calendar/YouTube
4. Screen Control
   - Check capabilities/status, attempt a safe action (or screenshot)
5. Telemetry
   - Enable telemetry → exercise flows → check `/api/v2/telemetry/*`
6. History
   - Verify `/api/v2/conversation/history` and UI display

Playwright and integration scripts: `tests/e2e/*.js`, `scripts/integration/*`.

## Data/Control Flow (High Level)
```
Desktop (React UI) ──> services/api.js (axios+SSE) ──HTTP/SSE──> FastAPI (Railway)
        │                          │                         │
        │                          └── Telemetry (renderer)──┘
        │                                 │
        └── Electron IPC (preload) ──> telemetry.cjs ──HTTP──> /api/telemetry/batch

Google OAuth: Desktop openExternal → Backend auth URL → User consent → Desktop polls /google/status
```

## Contracts & References
- Desktop brief: `agents.md`
- Connectivity: `docs/CONNECTIVITY_ROADMAP.md`
- Telemetry: `docs/TELEMETRY_PIPELINE.md`
- Backend integration summary: `docs/architecture/BACKEND_INTEGRATION_COMPLETE.md`
- Doc index: `docs/README.md`

## Notes & Watchouts
- Keep backend routes aligned with `/api/v2/*` to minimize fallbacks
- Ensure `X-API-Key` is present on protected routes; handle 401s gracefully
- Telemetry endpoints/keys must match renderer and broker configuration
