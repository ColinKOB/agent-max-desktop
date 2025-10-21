# Agent Max Desktop — E2E Connectivity Test Report

## Overview
- **Goal**: Validate that the frontend (`agent-max-desktop`) and backend (`Agent_Max`) are communicating correctly for key features, including Settings, Tools, Agents, Conversation Memory, and Profile endpoints.
- **Result**: All targeted connectivity tests passed. UI flow was updated to match the new Apple-style FloatBar.

## Environment
- **Frontend**: Vite dev server with HashRouter at `http://localhost:5173`.
  - Routes: `/#/settings`, `/#/card`.
  - Primary UI: `AppleFloatBar`.
- **Backend**: FastAPI server at `http://localhost:8000`.
- **Runner**: Playwright Chromium.

## Test Suite
File: `tests/e2e/connectivity.spec.js`

- T1. Settings can point to API and health responds
  - Navigate to `/#/settings`.
  - If visible, fill `API Endpoint` with `http://localhost:8000` and save.
  - Verify `GET /health` returns `{ status: "healthy" }`.

- T2. Tools button emits `tools_open` event (card mode)
  - Navigate to `/#/card`, expand the mini pill if present.
  - Click the Tools button (`button[title="Tools"], button[aria-label="Tools"]`).
  - Assert a window `amx:ui` event is dispatched with `detail.type === 'tools_open'`.

- T3. Conversation memory stores and returns context
  - `POST /api/v2/conversation/message` with `{ role: 'user', content: 'Hello from E2E test' }`.
  - `GET /api/v2/conversation/context?last_n=1` and assert `message_count > 0`.

- T4. Profile endpoints respond
  - `GET /api/v2/profile` returns profile object.
  - `GET /api/v2/profile/greeting` returns greeting string.

- T5. Agents REST endpoints respond
  - `GET /api/v2/agents/providers`, `GET /api/v2/agents/roles`, `GET /api/v2/agents/list` all return 200.

## Results
- Command: `npx playwright test tests/e2e/connectivity.spec.js --project=chromium --reporter=list`
- Outcome: 5/5 tests passed (~5.6s)
  - T1: PASS — health OK
  - T2: PASS — Tools event observed
  - T3: PASS — conversation message stored and retrieved
  - T4: PASS — profile and greeting OK
  - T5: PASS — agents endpoints OK

## Changes Made During Testing
- Updated `tests/e2e/connectivity.spec.js` to reflect the Apple-style FloatBar UI and event-driven Tools button:
  - Replaced brittle selector `button[title="Tools: Screen Control & Agents"]` and `AI Agents` text checks.
  - Now targets `button[title="Tools"], button[aria-label="Tools"]` and asserts `amx:ui` `tools_open` event.
- Added direct REST checks for agents, conversation, and profile.

## Code References
- Frontend components
  - `src/components/FloatBar/AppleFloatBar.jsx`: Tools button uses `title="Tools"` and dispatches `amx:ui` event with `detail.type = 'tools_open'`.
  - `src/components/FloatBar/FloatBarCore.jsx`: Bar-only UI also emits `amx:ui` `tools_open` on Tools click and uses `aria-label="Tools"`.
  - `src/main.jsx`: Routes include `/#/card` and `/#/settings`.
- Service APIs
  - `src/services/api.js`: `chatAPI.sendMessageStream(...)` uses `/api/v2/autonomous/execute/stream` (candidate for SSE test coverage).

## Findings
- **Backend health** is good and reachable from the frontend.
- **Tools interaction** is event-driven; no guaranteed visible “Agents” panel in current Apple FloatBar mode. Event assertion is the correct integration signal.
- **Conversation memory** persists and returns context correctly.
- **Profile** endpoints respond with expected data.
- **Agents** providers/roles/list endpoints are reachable and return 200.

## Gaps & Recommendations
- Create Agent UI flow is not covered (may require provider API keys):
  - Option A: Introduce a mock/demo provider (e.g., Local LLM) usable in tests.
  - Option B: Mock network with Playwright `route` to simulate create/list for E2E.
- Add SSE streaming test for `POST /api/v2/autonomous/execute/stream` to verify UI thinking → answering transitions.
- If a Tools panel UI appears in future, add a visual assertion (e.g., panel header) in addition to the event assertion.
- Consider running a targeted Electron E2E in addition to dev-server-based tests for parity.

## How To Run
1. Start backend at `http://localhost:8000`.
2. Start frontend dev server at `http://localhost:5173`.
3. From `agent-max-desktop/`, run:
```
npx playwright test tests/e2e/connectivity.spec.js --project=chromium --reporter=list
```

## Artifacts
- Playwright outputs (screenshots/videos) under `test-results/` for any test failures.
