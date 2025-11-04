# Agent_Max Backend on Railway — Overview

Updated: Nov 2025
 
Last Verified
- Date: 2025-11-04
- Environment: production target (documentation level)
- API smoke: tests/api/smoke-v2.spec.js added (run via `npm run test:api` with API_URL/TEST_API_KEY)

## Purpose
One-stop reference for the FastAPI backend (Agent_Max) deployed on Railway: how it’s built, configured, verified, and consumed by the desktop app.

## Service Summary
- Hosting: Railway (primary production)
- Build: Dockerfile.production (verified)
- Primary Health: `GET /health`
- Key Protected Routes: Require header `X-API-Key`
- Related doc: `docs/CONNECTIVITY_ROADMAP.md` (curl script and current status)

## Environment & Configuration
- Required environment variables (per CONNECTIVITY_ROADMAP):
  - `API_KEY` (required for protected routes)
  - `SECRET_KEY`
  - `OPENAI_API_KEY`
  - `DATABASE_URL` (PostgreSQL)
  - `REDIS_URL` (if used)
  - `JWT_SECRET`
  - `ENVIRONMENT=production`
  - Optional/related: `ENABLE_TELEMETRY=1` (for `/api/telemetry/batch`)
- Headers expected from desktop:
  - `X-API-Key` (protected routes)
  - `X-User-Id` (optional, for personalization/analytics)

## Endpoints (by capability)
Note: Desktop targets stable `v2` routes and includes fallbacks to older paths where needed. Ensure production routes align with these.

- Health & Diagnostics
  - `GET /health`
  - `GET /api/memory/health`
  - `GET /api/memory/debug/stats`

- Chat & Autonomous
  - Streaming chat (helpful/chatty modes): `POST /api/v2/chat/streaming/stream`
  - Streaming autonomous (executes tools): `POST /api/v2/autonomous/execute/stream`
  - Non-stream fallbacks (JSON): `POST /api/v2/chat/message`

- Conversation & Preferences
  - `GET /api/v2/conversation/context`
  - `GET /api/v2/conversation/history`
  - `GET /api/v2/conversation/history/{id}`
  - `POST /api/v2/preferences/analyze`, `PUT /api/v2/preferences/{key}`

- Profile, Facts, Semantic
  - `GET /api/v2/profile`, `GET /api/v2/profile/greeting`
  - `POST /api/v2/facts/extract`, `GET /api/v2/facts`
  - `POST /api/v2/semantic/similar`, `POST /api/v2/semantic/embedding`

- Screen Control (host capability dependent)
  - `GET /api/v2/screen/capabilities`, `GET /api/v2/screen/status`
  - `POST /api/v2/screen/click`, `/type`, `/scroll`, `/screenshot`, etc.

- Google Services
  - `GET /api/v2/google/status`
  - `GET /api/v2/google/messages`, `GET /api/v2/google/calendar/events`
  - `GET /api/v2/google/youtube/search`
  - `GET /api/v2/google/docs/{documentId}`, `GET /api/v2/google/sheets/{spreadsheetId}/range`
  - OAuth start path: `/api/v2/google/auth/start` or `GET /api/v2/google/auth/url` (desktop will prefer `/auth/url` when present)

- Telemetry
  - Legacy: `PUT /api/telemetry/batch`, `GET /api/telemetry/health`
  - v2 stats: `GET /api/v2/telemetry/stats`, `GET /api/v2/telemetry/interactions`

- Credits & Agents (if enabled)
  - `GET /api/v2/credits/balance/{userId}`, `POST /api/v2/credits/checkout`
  - `GET /api/v2/agents/providers`, `POST /api/v2/agents/create`, etc.

## Build & Deploy on Railway
- Dockerfile: Use `Dockerfile.production` (confirmed in CONNECTIVITY_ROADMAP)
- Config: Set env vars above in the Railway service (e.g., `Agent_Max`)
- Notes:
  - Prefer a single authoritative service ("Agent_Max"). Legacy/obsolete services (e.g., "agent-max-api") may be removed or disabled to reduce confusion
  - Rotate `API_KEY` securely and sync with desktop settings

## Verification
Use the curl verification script from `docs/CONNECTIVITY_ROADMAP.md`.

Quick excerpt:
```sh
API_URL="https://<your-railway-domain>"
API_KEY="<your_api_key>"

curl -sS "$API_URL/health"
curl -sS "$API_URL/api/memory/health"
# Protected route
curl -sS -H "X-API-Key: $API_KEY" "$API_URL/api/v2/screen/status"
```

## Observability & Troubleshooting
- Logs: Use Railway dashboard logs for build/runtime
- Common symptoms:
  - `401 Unauthorized` → Check `X-API-Key` header and backend `API_KEY`
  - `404` on `/api/v2/*` → Confirm router paths/versions; the desktop tries a set of fallback paths
  - Memory/DB issues → Confirm `DATABASE_URL` and `api/memory/health`
  - Telemetry 401/404 → Confirm `/api/telemetry/batch` and `ENABLE_TELEMETRY`

## Security Considerations
- Keep `API_KEY`, `OPENAI_API_KEY`, `SECRET_KEY`, `JWT_SECRET` private and rotated
- Validate CORS and auth for protected routes
- For autonomous tools/screen control, enforce server-side safety policies

## Architecture Notes (Authoritative Backend)
- The backend is intended as the single source of truth:
  - Data: PostgreSQL via `DATABASE_URL`
  - Optional caching (Redis)
  - Orchestrator + engine and cache layers (see docs/architecture/* in desktop repo)
- Desktop clients are thin and include fallbacks only for resilience; prefer backend-driven behavior
