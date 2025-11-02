Agent Max — Project Overview and Operating Guide

Purpose
- Agent Max is a desktop (Electron + React) assistant backed by a Python FastAPI service deployed on Railway.
- Goal for beta: collect telemetry to proactively catch issues, while preserving stability and security.

High‑Level Architecture
- Desktop app (repo: agent-max-desktop)
  - Electron main process: window management, IPC bridge, updater, crash reporting, and the telemetry broker.
  - Renderer (React): UI, features, and a telemetry client that routes events through the Electron preload bridge.
- Backend API (repo: Agent_Max)
  - FastAPI app serving feature flags, memory, chat/streaming, and telemetry endpoints.
  - Deployed to Railway with Redis + Postgres.

Key Paths and Files
- Desktop
  - electron/telemetry.cjs — main-process telemetry broker (batches logs → backend)
  - electron/preload.cjs — exposes `window.telemetry` to the renderer
  - src/services/telemetry.js — renderer telemetry client with IPC fallback to broker
  - docs/TELEMETRY_PIPELINE.md — pipeline details
- Backend
  - api/main.py (and main_v2.py) — app wiring and router mounts
  - api/routers/feature_flags.py — structured feature-flag response
  - api/routers/telemetry.py — telemetry ingestion (POST and PUT /api/telemetry/batch)
  - api/models/telemetry.py — TelemetryBatch + event schemas

Environment Variables (Production)
- API_KEY — primary API key (used by desktop for all API calls)
- TELEMETRY_API_KEY — dedicated key for telemetry (can temporarily mirror API_KEY)
- ENABLE_TELEMETRY — set to 1 to enable the telemetry router
- CORS_ORIGINS — must include `app://agent-max` and relevant domains
- Other: Redis, Postgres, OpenAI keys, etc. (managed in Railway)

Build / Run (Desktop)
- Dev: `npm run electron:dev` (starts Vite + Electron)
- Build: `npm run electron:build` (or platform-specific scripts)
- Tests: `npm run test -- tests/unit/telemetryService.test.js tests/unit/electronTelemetry.test.js`

Build / Run (Backend)
- Local: `uvicorn api.main:app --port 8000` (dev)
- Railway: auto-deploy from GitHub; or `railway up` from project folder

Telemetry Pipeline
- Renderer logs → `window.telemetry` → Electron broker → batch → `PUT /api/telemetry/batch`
- Backend stores to JSONL (and/or cloud sink); logs `telemetry_batch_ingested` on success

Production Smoke Tests
1) Feature flags (should 200):
   curl -H "X-API-Key: $API_KEY" https://agentmax-production.up.railway.app/api/v2/feature-flags
2) Telemetry (should 200 with success):
   curl -X PUT https://agentmax-production.up.railway.app/api/telemetry/batch \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $API_KEY" \
     --data '{"events":[{"type":"custom_event","userId":"curl","sessionId":"curl","timestamp":"2025-11-01T12:00:00Z","eventName":"curl.smoke","properties":{"source":"curl"}}]}'
   (If the old code is still running, use the legacy wrapper: '{"value":{...}}')

Best Practices Notes
- Keep telemetry endpoint secured via API key; prefer a dedicated key in prod.
- Allow PUT and POST; accept both modern and legacy payload shapes to avoid brittle client breakage.
- Log `telemetry_batch_ingested` on success for easy verification.
- Keep crash reporting and updater configs stable; don’t weaken security settings in production.

Common Gotchas
- JSON body must be on a single line in curl (no line breaks inside the JSON string).
- If `/api/telemetry/batch` rejects with "Invalid or missing API key", ensure Railway is running the commit with updated telemetry router or temporarily mirror TELEMETRY_API_KEY to API_KEY.
- If it rejects with `Field required: value`, the old router is still deployed—redeploy the branch containing `_parse_batch_payload`.

