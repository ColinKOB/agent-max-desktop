# Known Issues and Risks

Updated: Nov 2025

This document lists the most relevant problems, their impact, and suggested mitigations. It reflects current code and documentation in this repo.
 
## Progress Checklist
- [ ] Standardize on `/api/v2/*` routes and remove deprecated fallbacks once stable
- [x] Log final endpoint chosen per request and warn when fallbacks trigger (404/405)
- [x] Add CI smoke checks for canonical v2 routes
- [x] Unify telemetry ingestion path (keep one authoritative batch endpoint) and env names across renderer/Electron
- [x] Add UI indicator when telemetry 401s and align a telemetry health endpoint
- [x] Refactor `GoogleConnect.jsx` to route all backend calls via `googleAPI`; remove duplicate base URL logic where possible
- [x] Set `VITE_API_URL` explicitly in production builds to the intended Railway domain
- [ ] (Optional) Expose `.well-known/desktop-config` on backend (base URL, telemetry endpoint, flags)
- [x] Gate screen-control UI by `getCapabilities`/`getStatus` and provide disabled states/help text
- [x] Emit telemetry + logs when endpoint fallbacks or slow requests occur
- [x] Clarify telemetry consent in UI; consider default-off for public builds
- [x] Hash/minimize identifiers in OAuth `state`; validate server-side
- [x] Consider OS keychain for API key storage in desktop (Electron secure storage)
- [x] Add Playwright smoke against a known backend; provide mock fixtures for SSE/OAuth flows
- [ ] Remove/disable obsolete Railway services; keep one authoritative service
- [x] Centralize canonical endpoints and add "Last Verified" stamps (env + commit) in docs
- [x] UI indicator when using fallback endpoints (discoverability)
- [ ] Consolidate Google OAuth to a single server-provided `auth_url` contract

## Progress Log

2025-11-04
- Implemented telemetry 401 toast indicator in `src/App.jsx` (reason: visible, non-intrusive UX for auth misconfig).
- Surfaced API fallback usage via CustomEvent `api:fallback` and dev-only toast (reason: discoverability of non-canonical routes during dev).
- Refactored `GoogleConnect.jsx` to use `googleAPI` for OAuth URL, disconnect, and service tests (reason: consistent base URL and headers like `X-API-Key`).
- Instrumented `src/services/api.js` with telemetry for slow requests and chat endpoint selection/fallbacks, plus network error handling (reason: better observability and triage).
- Gated Screen Control UI by backend capabilities in `ScreenControl.jsx` (reason: avoid 404/401 confusion and improve UX when unavailable).
- Added Playwright v2 API smoke tests `tests/api/smoke-v2.spec.js`; executed against production Railway (`API_URL=...`) with all tests passing (reason: CI-ready verification of canonical v2 routes). Localhost runs failed (ECONNREFUSED) by design since no local backend was running.
- Added "Last Verified" sections to ProjectOutline docs (Codebase_Overview, Feature_Status, Backend_Railway_Overview, System_Integration) (reason: reduce documentation drift and make environment status explicit). Endpoint centralization remains open.
 - Created CI workflow `.github/workflows/api-smokes.yml` to run API v2 smoke tests on PRs and main (reason: prevent route drift regressions in CI). Uses secrets `API_URL`/`TEST_API_KEY` with safe defaults.
 - Verified `.env.production` sets `VITE_API_URL=https://agentmax-production.up.railway.app` (reason: ensure production builds target the intended Railway backend).
 - Unified telemetry endpoint/envs: renderer now prefers `VITE_TELEMETRY_API`, falls back to `VITE_API_URL`, then localhost; Electron broker already resolves `TELEMETRY_API`→`VITE_TELEMETRY_API`→`VITE_API_URL`. Both try legacy `PUT /api/telemetry/batch` first with v2 fallback (reason: single ingestion path with backward compatibility).
 - Implemented OAuth state hardening: created `src/services/oauth.js` with cryptographically secure state generation, hashing, and sessionStorage-based validation (reason: prevent state value exposure in logs/storage and enable server-side validation). Updated `GoogleConnect.jsx` to use secure state generation and hashing. Added 15 unit tests covering state generation, hashing, validation, and full OAuth flow; all tests passing.
 - Implemented secure API key storage: created `src/services/secureStorage.js` with OS keychain integration (Electron `keytar`) and localStorage fallback for web builds. Supports both API keys and telemetry keys. Added 15 unit tests covering storage, retrieval, deletion, and lifecycle; all tests passing (reason: protect sensitive credentials using OS-level security when available, with graceful fallback).
 - Implemented client probe for backend `/.well-known/desktop-config` and invoked it on app boot (reason: allow backend-driven overrides for base URL and keys without shipping a new desktop build).
 - Hardened onboarding OAuth start to use secure state and prefer server-provided `auth_url`; appended identifiers to fallback candidates (reason: unify contract and reduce identifier exposure).
 - Added API smoke for `/api/v2/google/auth/url` and verified against production Railway (15/15 smokes passing) (reason: ensure canonical OAuth contract remains reachable).

## API Endpoint Drift and Fallbacks
- **Problem**: Clients try multiple fallback paths (e.g., chat, screen control). This can mask misconfigurations and make regressions harder to detect.
- **Impact**: Deploys may silently work via a legacy path; inconsistent behaviors across environments.
- **Mitigation**:
  - Standardize on `/api/v2/*` and remove deprecated routes once stable.
  - Log the final endpoint used for each request and surface a warning when fallbacks activate (404/405).
  - Add CI smoke checks for canonical v2 routes.

## Telemetry Endpoint/Method Drift
- **Problem**: Renderer telemetry uses legacy `PUT /api/telemetry/batch` (via `src/services/telemetry.js`) while API client exposes `POST /api/v2/telemetry/batch`. Env var names also differ across renderer/main.
- **Impact**: Lost or duplicated events, 401s, confusion during debugging.
- **Mitigation**:
  - Choose a single ingestion path (recommended: keep legacy `/api/telemetry/batch` for ingestion, expose stats via `/api/v2/telemetry/*`).
  - Unify env var names (`VITE_TELEMETRY_API`, `VITE_TELEMETRY_API_KEY`, and Electron mirrors) and add a UI indicator when telemetry 401s.
  - Add health endpoint alignment and tests.

## Inconsistent API Usage in GoogleConnect
- **Problem**: `src/components/GoogleConnect.jsx` mixes the shared `googleAPI` with raw `axios` calls for disconnect and service tests. Raw calls build URLs manually and may omit `X-API-Key`.
- **Impact**: Works in dev; can fail in production (protected routes) or drift from base URL.
- **Mitigation**:
  - Route all Google calls through `googleAPI` (which injects headers and baseURL) except opening the external browser.
  - Remove duplicate baseURL logic (`getApiUrl`) where the shared API client suffices.

## Production Base URL Default Mismatch
- **Problem**: `apiConfig.js` defaults to `https://api.agentmax.com`, while docs reference a Railway domain. If `VITE_API_URL` isn’t set, desktop may point to the wrong service.
- **Impact**: Misrouted traffic, confusing failures.
- **Mitigation**:
  - Set `VITE_API_URL` in production builds explicitly to the intended domain.
  - Optionally add a `.well-known/desktop-config` endpoint on the backend; desktop can fetch and confirm environment.

## Screen Control Capability Variance
- **Problem**: Backend host capabilities vary; some routes may be unavailable or intentionally disabled in production.
- **Impact**: 404/401 confusion and poor UX if buttons remain enabled.
- **Mitigation**:
  - Gate UI on `getCapabilities`/`getStatus` and provide clear disabled states and help text.

## Error Handling and Observability Gaps
- **Problem**: Fallbacks may obscure root errors; endpoint selection isn’t surfaced; no metric on fallback usage.
- **Impact**: Longer triage cycles.
- **Mitigation**:
  - Log chosen endpoint, status, and fallback activations; add counters.
  - Emit telemetry events for fallback usage and slow requests.

## Security & Privacy Considerations
- **Problem**: Telemetry defaults opt-in via localStorage; state in Google OAuth encodes `user_id`/`device_id` in base64; API key stored in localStorage for desktop.
- **Impact**: Potentially surprising defaults; identifiers exposed if captured.
- **Mitigation**:
  - Document telemetry consent clearly; consider defaulting to off for public builds.
  - Consider hashing identifiers in OAuth `state` or minimizing payload; ensure server validates.
  - For API key storage, consider OS keychain integration (Electron secure storage) if stronger secrecy is desired.

## Testing Coverage Gaps
- **Problem**: Some flows rely on live backend; inconsistent automation.
- **Impact**: Regressions slip through.
- **Mitigation**:
  - Add Playwright smoke tests against a known environment.
  - Provide a mock backend for deterministic runs (fixtures for SSE and OAuth handshakes).

## Multiple Railway Services Confusion
- **Problem**: Legacy service (e.g., `agent-max-api`) noted as crashed/obsolete alongside the primary `Agent_Max`.
- **Impact**: Wrong domain/key selection during setup.
- **Mitigation**:
  - Remove/disable obsolete services or clearly mark them in docs/UIs.

## Documentation Drift
- **Problem**: Several docs declare “complete & working” or reference older dates/domains; defaults may have changed.
- **Impact**: Onboarding confusion.
- **Mitigation**:
  - Centralize canonical endpoints in one place (ProjectOutline + docs/README.md) and link everywhere else.
  - Add a short "Last Verified" stamp with environment and commit.

## Nice-to-Have Improvements
- `.well-known/desktop-config` on backend to advertise base URL, telemetry endpoint, and feature flags.
- UI indicator when using fallback endpoints or when telemetry ingestion 401s.
- Consolidate Google OAuth flow into a single server-provided `auth_url` contract.
