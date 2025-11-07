# Legacy Code Cleanup – Actions Executed (2025-11-06)

## Changes Implemented
- Switched Settings billing tab to comprehensive billing UI.
  - Replaced `BillingSimple` with `BillingSettings` in `src/pages/SettingsApp.jsx`.
- Migrated subscription API calls to prefer v2 with fallback.
  - Updated `subscriptionAPI` in `src/services/api.js` to use `/api/v2/subscription/*` and fall back to `/api/subscription/*`.
- Archived dangerous script.
  - Added `docs/DEPRECATED/Misc/delete_dead_code.md` with original `scripts/build/delete_dead_code.sh` contents.
- Converted legacy components/services to Markdown in `docs/DEPRECATED/*` (prior step), pending deletion of originals per user approval.
- Migrated `memoryAPI` endpoints to v2 with graceful fallbacks.
  - Updated `src/services/memoryAPI.js` to prefer `/api/v2/*` for facts, messages, stats, health, extract, apply; falls back to legacy `/api/memory/*` on 404/405 or network errors.
  - Left `query()` retrieval behavior intact.
  - Fixed `SettingsApp.jsx` import to use the named export `{ BillingSettings }` to resolve build error.
- Normalized autonomous streaming events in `src/services/api.js` `chatAPI.sendMessageStream`.
  - Accepts `type` or `event` keys, maps `complete` → `final`, and standardizes `final`/`done` to include `data.final_response` even when backend returns top-level `final_response`.
  - Deprecated the `X-Events-Version: 1.1` header; no longer sent by the client.

## Legacy cleanup status (completed)
- Legacy FloatBar stack, WS autonomous harness, and stray `Untitled-*` originals have been removed after archiving.
- GPT-5 pricing doc has been moved to `docs/GPT-5-Docs/OpenAI_GPT-5_Pricing_Updated_2025.md`; original no longer present.
- Deprecated files removed:
  - `src/components/SubscriptionManager.jsx` (older prototype)
  - `src/pages/BillingSimple.jsx`
  - `src/pages/Settings.jsx`
  - `src/pages/SettingsApp.enhanced.jsx`
  - `scripts/build/delete_dead_code.sh` (archived to docs)

## Notes on v2 vs legacy
- Keep legacy fallbacks in `chatAPI.sendMessageStream` until backend parity is stable.
- `memoryAPI` has been migrated to v2 for facts/messages/stats/health/extract/apply with controlled legacy fallbacks. `query()` already used v2 and was retained.

## Next Steps
- Triage Playwright exit code discrepancy despite all tests passing.
- Improve Lighthouse performance scores (code-splitting, asset optimization).

## Build & Test Results (2025-11-06)
- Build: SUCCESS (`npm run build`).
- API tests: SUCCESS (15 passed) via `npm run test:api`.
- E2E tests: Playwright reported all tests passed (155 passed) but returned exit code 1 when invoked via `npm run test:e2e` and `npm run test:e2e:json`. Needs triage.
- Consolidated runner (`scripts/run-all-tests.js`):
  - Added Chalk CJS fallback shim for Node 22 (ESM-only chalk v5) to prevent crashes.
  - E2E phase marked as failed due to Playwright non-zero exit code despite passing tests.
  - Performance (Lighthouse): Perf 50, A11y 82, Best Practices 75 (thresholds not met). Bundle-size check passed.
- Unit tests added (stream normalization):
  - Added `tests/unit/chat_stream_normalization.test.js` covering:
    - Agent v1.1 stream: `ack/plan/token/final/done` → ensures `data.final_response` is present.
    - Autonomous Phase 3 stream: `thinking/complete/done` with top-level `final_response` → normalized to `final` and `done` with `data.final_response`.
    - Alias support for `event` key and POST + headers (does NOT send `X-Events-Version`).
  - Result: PASS (3/3) when run isolated.

## Triage Items
- Investigate Playwright exit code discrepancy:
  - Inspect reporters/config or hidden flaky tests. Use `npx playwright show-report` for details.
  - Consider updating `test:e2e` script reporter or CI tolerance to avoid non-actionable failures when tests pass.
- Evaluate performance thresholds or exclude heavy assets; consider code-splitting to improve Lighthouse score.
