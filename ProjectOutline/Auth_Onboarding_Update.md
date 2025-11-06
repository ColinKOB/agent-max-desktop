# Auth & Onboarding Update

Date: 2025-11-05
Owner: Cascade
Status: In review (frontend done, backend token store error pending)

---

## Summary
- Split onboarding to make Email sign-in mandatory on its own page.
- Google step is optional and clearly labeled "Connect Google" (not a sign-in substitute).
- Surfaced backend OAuth callback errors (e.g., "Failed to store tokens") with toast + inline error and a Try Again button.
- Small copy and UX refinements to reduce confusion and unblock progress.

## Files Changed
- src/components/GoogleConnect.jsx
  - Button text: Sign in → Connect Google
  - Error surfacing from status endpoint and Try Again button
- src/components/onboarding/OnboardingFlow.jsx
  - Steps: Name → How can I help? → Email (mandatory) → Connect Google (optional) → Complete
  - New EmailSignInStep (mandatory)
  - GoogleConnectStep cleaned (removed embedded email UI, added Skip)
  - Fixed import order (EmailSignInStep now declared after imports)

## UX Goals
- Email account creation must be explicit and required before integrations.
- Google is an integration to enable Gmail/Calendar, not primary auth.
- OAuth failures show actionable error text and allow retry.

## Test Plan (Manual)
1. Launch app (electron dev).
2. Onboarding flow
   - Name → proceed
   - How can I help → select → proceed
   - Email → enter valid email + strong password → Continue
   - Connect Google (optional)
     - Click Connect Google → external browser opens
     - If backend succeeds: status flips to connected, email displayed
     - If backend fails: toast + inline error shows exact message (e.g., Failed to store tokens), Try Again available
     - Skip for now should advance to Complete
3. Verify copy changes
   - Button reads "Connect Google"
   - Step title reads "Connect Google (optional)"
4. Regression checks
   - Back button navigates correctly
   - Onboarding completion sets onboarding_completed=true in local storage and preferences

## Known Issues / Backend Follow-ups
- The error "Failed to store tokens" originates on backend.
  - Validate GOOGLE_CLIENT_ID/SECRET, callback URL, DB storage, encryption.
  - Confirm Google Console Authorized Redirect URIs match backend callback exactly.
- Desktop secure keychain exposure not wired via preload; secureStorage falls back to localStorage in web.
  - Consider IPC-exposed keytar methods in main + preload for OS keychain usage.

## Next Steps
- Add unit tests for new onboarding steps (Email mandatory, Google optional).
- Add e2e script for OAuth round-trip with mocked callback (or test env credentials) and capture status transitions.
- Optional: Implement keytar IPC bridge and update secureStorage to prefer OS keychain in Electron.

---

## Verification Log
- 2025-11-05: UI copy updated; onboarding reordered; error surfacing and retry added; manual smoke passes through steps; OAuth error visible when backend returns error.
