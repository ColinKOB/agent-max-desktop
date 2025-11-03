# Agent Max Connectivity Roadmap (Frontend ↔ Backend via Railway)

## Objective
Restore and ensure robust connectivity between Agent Max Desktop (frontend) and the production backend on Railway.

- Backend URL: https://agentmax-production.up.railway.app
- Primary health: GET /health
- Memory API: GET /api/memory/health, POST /api/memory/messages, GET /api/memory/debug/stats
- Protected routes: Require header `X-API-Key` (e.g., /api/v2/screen/status)

## Current Status (Summary)
- Backend is healthy and reachable at the production URL.
- Memory endpoints are live and responding.
- Telemetry (legacy path) responds at /api/telemetry/health.
- Frontend now updates the API key and axios default headers when saving Settings.
- Railway service "Agent_Max" has required environment variables configured.

## Work Completed
- Verified backend health: /health returns healthy.
- Verified memory subsystem:
  - /api/memory/health returns healthy and DB connected
  - /api/memory/debug/stats returns stats JSON
- Confirmed Railway build uses Dockerfile.production via railway.toml/railway.json.
- Confirmed production env vars on Railway (Agent_Max):
  - API_KEY, SECRET_KEY, OPENAI_API_KEY, DATABASE_URL, REDIS_URL, JWT_SECRET, ENVIRONMENT=production, etc.
- Frontend patch:
  - `reconfigureAPI(baseURL, apiKey)` now persists API key and syncs axios `X-API-Key` header immediately.
- Telemetry legacy path healthy: /api/telemetry/health.

## Open Items / Observations
- /api/v2/screen/status returned 404 in one probe; likely version/path drift or requires auth. Will re-test with `X-API-Key`.
- End-to-end front-end tests pending final verification.

## Next Steps (Checklist)
- [ ] Verify backend with curl (health, memory, protected route):
  - [ ] GET /health
  - [ ] GET /api/memory/health
  - [ ] POST /api/memory/messages (simple payload)
  - [ ] GET /api/v2/screen/status with `X-API-Key`
- [ ] Frontend Settings test:
  - [ ] Set API URL to production
  - [ ] Set API Key (from Railway) and Save
  - [ ] Test Connection (should succeed)
  - [ ] Screen Control → Check Status (should respond; availability may be false on servers without desktop deps)
- [ ] Optional: Align telemetry v2 path if desired (non-blocking)
- [ ] Optional: Clean up or disable stale Railway service "agent-max-api" (crashed) to reduce confusion

## Verification Script (curl)
Run from any shell (replace `API_KEY` if rotated):

```sh
API_URL="https://agentmax-production.up.railway.app"
API_KEY="<your_api_key>"

echo "GET /health" && curl -sS "$API_URL/health" && echo "\n"

echo "GET /api/memory/health" && curl -sS "$API_URL/api/memory/health" && echo "\n"

echo "POST /api/memory/messages" && curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello from e2e","session_id":"desktop_e2e"}' \
  "$API_URL/api/memory/messages" && echo "\n"

echo "GET /api/v2/screen/status (protected)" && curl -sS -H "X-API-Key: $API_KEY" \
  "$API_URL/api/v2/screen/status" && echo
```

## Rollback/Recovery Plan
- If curl checks fail:
  - Confirm Railway env vars present (especially SECRET_KEY, API_KEY, OPENAI_API_KEY, DATABASE_URL, REDIS_URL).
  - Trigger redeploy on the "Agent_Max" service and monitor logs.
  - Verify Dockerfile.production build settings remain intact in railway.toml.

## Ownership and Notes
- Primary service: "Agent_Max" (healthy). Secondary "agent-max-api" is obsolete/crashed.
- Frontend defaults: .env.production points to production API and includes a sample VITE_API_KEY; Settings can override.
- Maintain quality-first approach; verify via curl and front-end Settings before declaring complete.
