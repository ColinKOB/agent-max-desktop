# Unfinished Tasks Review

Date: 2025-10-28

## Summary of updates just applied

- Marked implemented in `IMPLEMENTATION_STATUS.md`:
  - User initialization on app start.
  - CreditDisplay integrated into FloatBar.
  - Credit check and token-based deduction after response.
  - Purchase flow (Stripe checkout component).
- Marked implemented in `SUPABASE_SETUP_STATUS.md` (Frontend):
  - @supabase/supabase-js installed.
  - src/services/supabase.js added.
  - responseCache now checks Supabase first.

---

## High-priority unfinished items (P0)

- **[Production Stripe keys configured]**
  - Files: `PRODUCTION_READINESS_REPORT.md` (Final Steps for Launch), `API_KEYS_STATUS.md`
  - Tasks: Configure live `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, and production webhook secret. Verify with a live payment smoke test.

- **[Backend deployment + environment]**
  - Files: `PRODUCTION_READINESS_REPORT.md` (Deploy to Railway)
  - Tasks: Deploy backend (Railway), set env vars, update frontend `VITE_API_URL`.

- **[Monitoring and release readiness]**
  - Files: `SHIP_CHECKLIST.md` (Final Sign-Off), `PRODUCTION_READINESS_REPORT.md`
  - Tasks: Deployment pipeline, monitoring dashboards, alerts, release notes.

---

## Credits & billing UI

- **[Settings page credit management]**
  - File: `IMPLEMENTATION_STATUS.md` (Task 6)
  - Status: Not implemented.
  - Scope: Add Credit balance section, Purchase button, and basic purchase/usage history pulled from `telemetry_events`.

---

## Supabase integration follow-ups

- **[Replace Electron local memory with Supabase calls]**
  - File: `SUPABASE_SETUP_STATUS.md`
  - Status: Not done. Electron memory APIs still in use for profile/facts in places.
  - Scope: Migrate reads/writes to Supabase-backed services or make Electron layer a transparent cache of Supabase.

- **[Consent UI for data collection scopes]**
  - File: `SUPABASE_SETUP_STATUS.md`
  - Status: Not implemented.
  - Scope: UI for toggling scopes and persisting to `users.scopes`.

---

## UX gaps from verification checklist (Phase 1–2 follow-ups)

Source: `docs/VERIFICATION_CHECKLIST.md`

- **Draft autosave attachments**
  - Status: Partial – attachments not persisted/restored.

- **Undo windows**
  - Missing: Memory-save undo.

- **Stop → Continue**
  - Status: Partial – Continue needs backend integration; tool waits cancellation not implemented.

- **Message actions**
  - Missing: Regenerate uses original prompt; Fork confirmation dialog UI.

- **Session management**
  - Missing: Real conversation IDs instead of hardcoded 'current'.

- **Undo snapshot**
  - Missing: Scroll position restore; attachment restore.

- **Error handling & recovery**
  - Missing: Actionable errors (network/auth/timeout/rate limit) and retry with backoff.

- **Accessibility & keyboard help**
  - Missing: Shortcut palette ('?' reference panel).
  - Missing: Reduced motion/transparency honoring OS prefs.

---

## Phase 4 (optional hardening) backlog

Source: `docs/phases/PHASE4_OVERVIEW.md`

- **Comprehensive error handling** with actionable toasts.
- **Auto-retry with backoff** and cancel.
- **Memory degradation handling** (banner, queue, reconnection flow).
- **Reduced motion** support.
- **Screen reader support** (ARIA, live regions, dialog semantics).
- **High contrast mode**.

---

## Execution plan UI polish (optional)

Source: `EXECUTION_PLAN_INTEGRATION.md`

- Frontend plan handling exists (plan/thinking events in `AppleFloatBar.jsx`), but:
  - Add dedicated `ExecutionPlan` component usage (approval/collapse/edit flow).
  - Progress bar polish and optional approval gating.

---

## Launch-readiness checklist (aggregate)

- **Stripe (production)**
  - Live secret + publishable keys set.
  - Prod webhook endpoint + secret configured.
  - Live purchase smoke test completes; credits added; telemetry logged.

- **Backend deployment**
  - API deployed (Railway), env configured, health checks pass.

- **Frontend configuration**
  - VITE_API_URL set to production backend URL.
  - Build and sign Electron app (mac/win/linux) and verify startup.

- **Ops**
  - Monitoring dashboards and alerts configured.
  - Release notes finalized and published.

---

## References (evidence of implemented items)

- Credit UI: `src/components/CreditDisplay.jsx` and usage in `AppleFloatBar.jsx`.
- Token-based deduction after response: `AppleFloatBar.jsx` (done-event handler with Supabase updates/telemetry).
- User initialization on startup: `src/App.jsx` (device_id + getOrCreateUser).
- Supabase services: `src/services/supabase.js`.
- Response cache uses Supabase first: `src/services/responseCache.js`.
- Purchase flow: `src/components/billing/CreditPurchase.jsx`.
