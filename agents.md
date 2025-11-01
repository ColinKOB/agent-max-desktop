## Agent Brief: agent-max-desktop (Electron/React)

### Mission & Composition
- **Role**: Electron shell + React UI delivering the Agent Max desktop experience. Wraps the FastAPI backend hosted in `../Agent_Max` (Railway).
- **Entry points**:
  - `electron/main.cjs` – boots windows, wires IPC, starts telemetry, crash reporting, updater.
  - `src/main.jsx` – React bootstrap (HashRouter linking pill/card/settings modes).
  - `start_app.sh` / `npm run electron:dev` – launch sequence (Vite dev server + Electron).
- **Key subsystems**:
  - `src/services/api.js` – axios client with environment-aware base URL selection and retries.
  - `src/services/telemetry.js` – renderer telemetry service that now bridges to main via IPC.
  - `electron/telemetry.cjs` – main-process telemetry broker (session/install tracking, log capture).
  - `HandsOnDesktopClient` (`electron/hands-on-desktop-client.cjs`) – pipeline for remote tool execution policies.
  - `supabase/` – local data sync for telemetry dashboards & auth fallbacks.

### Runtime Wiring
- Builds read `.env.production`; relevant variables:
  - `VITE_API_URL`, `VITE_API_KEY` – API endpoint/key for Agent_Max.
  - `VITE_TELEMETRY_API`, `VITE_TELEMETRY_API_KEY` plus mirrored `TELEMETRY_API`, `TELEMETRY_API_KEY` for Electron broker.
  - `VITE_SUPABASE_*` for Supabase telemetry/dashboards.
- On boot the Vite app instantiates `TelemetryService`, which calls `window.telemetry.getBootstrap()` (exposed in `electron/preload.cjs`). Events are forwarded to the main-process queue and posted to `/api/telemetry/batch`.
- `apiConfigManager` persists user-selected API URLs (non-prod) and defaults to Railway production if nothing else detected.
- Auto-detects local backend (`http://localhost:8000/health`) when running in dev.

### Relationship with `Agent_Max`
- Depends on stable `/api/v2/*` routes for memory, chat, autonomous, feature flags, telemetry stats.
- Expects API key headers (`X-API-Key`) and optional `X-User-Id` for personalization.
- Telemetry requires backend to expose `/api/telemetry/batch` with matching API key and `ENABLE_TELEMETRY=1`.
- Usage dashboard (`src/components/billing/UsageDashboard.jsx`) hits `/api/v2/telemetry/*` endpoints that read from backend JSONL store.
- Supabase fallbacks exist, but the preferred real-time event feed is the Railway backend.

### Build/Test Commands
```bash
# install deps
npm install

# dev loop (Vite + Electron)
npm run electron:dev

# production build artifacts (dist/ + release/)
npm run electron:build  # or platform-specific variants

# unit tests (Vitest + Electron bridges)
npm run test -- tests/unit/telemetryService.test.js tests/unit/electronTelemetry.test.js
```

### Observability Flow
- Main-process telemetry broker captures:
  - `app.lifecycle.install/launch/before-quit`
  - `electron-log` output and `console.*` calls (`main.console` events)
  - Batches to `/api/telemetry/batch` every 5s or 25 events.
- Renderer service records:
  - `interaction`, `error`, `performance`, `custom_event` payloads.
  - Falls back to direct HTTP POST if IPC bridge unavailable (e.g., standalone web build).
- Crash reporting via `electron/crash-reporter.cjs` uses Sentry (`SENTRY_DSN` env).

### Hot Spots / Improvement Ideas
- **Telemetry config drift**: unify env var names with backend (`ENABLE_TELEMETRY` check) and expose health indicator in UI when telemetry 401s.
- **API URL management**: add settings UI to confirm when using fallback vs production. Maybe push `.well-known/desktop-config` endpoint on backend.
- **Hands-on Desktop policies**: ensure Electron packaging includes updated `hands-on-desktop-client.cjs` with backend handshake keys.
- **Testing**: expand Vitest coverage beyond telemetry (API client mocks, feature flag toggles, onboarding flows). Consider Playwright smoke hitting live backend.
- **Auto-updater**: confirm release pipeline publishes to GitHub (see `electron-builder.json`) with correct notarization assets (`resources/entitlements.mac.plist`).

### Quick Start for a New Agent/Dev
1. Copy `.env.example` → `.env.local` (or adjust `.env.production`) and fill API / telemetry keys.
2. Run backend (`../Agent_Max`) locally with matching keys (see backend agents.md) or point to Railway.
3. `npm run electron:dev` – floatbar loads; Settings screen under `#/settings`.
4. Verify telemetry:
   - Inspect console logs for `Desktop Telemetry Broker` messages.
   - Hit backend `/api/telemetry/interactions` to ensure events arrived.
5. Package test build: `npm run electron:build:mac` (requires Apple cert), or `npm run electron:build` for platform matrix.

### Reference Docs Worth Skimming
- `README.md` (existing quick start + telemetry pointer).
- `docs/TELEMETRY_PIPELINE.md` – pipeline specifics updated after broker integration.
- `BETA_DISTRIBUTION_GUIDE.md` – distribution checklist for testers.
- `DESKTOP_PRODUCTION_CONFIG.md` in backend repo – environment contract.

Keep this briefing in sync whenever backend contracts or release tooling changes so downstream agents can pick up without spelunking the entire repo.***
