# Repo Structure Migration – Phase 0 (Aliases + Skeleton)

Date: 2025-11-10
Owner: Cascade (pair programming)

## Summary
- Added path aliases in Vite, Vitest, and Jest to enable a safe, staged migration:
  - `@app` → `src`
  - `@features` → `src/features`
  - `@shared` → `src/shared`
  - `@lib` → `src/lib`
  - `@electron` → `electron`
- Created folder skeletons for the new hierarchy (using .gitkeep) without moving existing files yet:
  - `src/app/`
  - `src/shared/{components/ui,hooks,contexts,store,styles,utils,types}`
  - `src/lib/{api,auth,telemetry,search,supabase,memory,logging,cache}`
  - `src/features/` (seed: `floatbar/`)
  - `electron/{main,preload,security,telemetry,autonomous,memory,integrations}`

This keeps current imports working while preparing for a best-practice, feature-first structure.

## Next Phases
1. Electron reorg (Phase 1)
   - Move existing Electron files into subfolders:
     - main/: `main.cjs`, `menu.cjs`, `updater.cjs`, `crash-reporter.cjs`, `devicePairing.cjs`, `test-window.cjs`
     - preload/: `preload.cjs`
     - security/: `ipc-validator.cjs`, `hmacVerifier.cjs`, `crypto-utils.cjs`
     - telemetry/: `telemetry.cjs`
     - autonomous/: `autonomousIPC.cjs`, `localExecutor.cjs`, `stubExecutor.cjs`
     - memory/: `memory-*.cjs`, `vault-*.cjs`, `migrate-to-vault.cjs`, `vault-schema.sql`
     - integrations/: `hands-on-desktop-client.cjs`

2. Services → lib (Phase 2)
   - Move `src/services/*` into `src/lib/*` domains.
   - Split `api.js` into `lib/api/client.js` + domain clients (health, chat, autonomous, memory, telemetry).

3. Feature-first colocation (Phase 3)
   - Create `src/features/{settings,billing,autonomous,memory,onboarding,profile,updates}`.
   - Move pages/components into their feature folders, keeping global primitives in `shared/components/ui`.

4. Imports + tests (Phase 4)
   - Update any relative imports → aliases where needed.
   - Run Vitest/Jest/Playwright/Electron tests and fix breakages.

## Risks & Mitigations
- Import churn: mitigated via aliases added in Phase 0.
- Jest path resolution: added `moduleNameMapper` to match Vite/Vitest.
- Electron packager: paths remain stable thanks to `@electron` alias; verify after moves.

## Verification Plan
- `npm run test -s` (unit) and `npm run test:e2e` (opt-in) to confirm resolution.
- `npm run electron:dev` smoke test UI and IPC.

## Notes
- Aligns with Agent Brief (Electron/React) and global rule to track changes in ProjectOutline.
- No business logic changed in Phase 0.

---

## Update (Phase 1 Completed)

Date: 2025-11-10

- Moved Electron files into subfolders: `main/`, `preload/`, `security/`, `telemetry/`, `autonomous/`, `memory/`, `integrations/`.
- Updated main-process requires and all `preload` path references.
- Updated package.json `main` → `electron/main/main.cjs`.
- Added compatibility shims to avoid breaking existing imports/tests:
  - `electron/telemetry.cjs` → forwards to `electron/telemetry/telemetry.cjs`.
  - `electron/hands-on-desktop-client.cjs` → forwards to `electron/integrations/hands-on-desktop-client.cjs`.
- Fixed telemetry broker test re-init by allowing IPC re-registration in `electron/telemetry/telemetry.cjs`.

### Phase 1 Verification
- Unit: `tests/unit/electronTelemetry.test.js` → PASS (2/2).
- Next: optional `tests/electron/*` and Playwright smoke.

## Update (Phase 2 – Telemetry Service Refactor)

Date: 2025-11-10

- Introduced `src/lib/api/telemetryClient.js` (legacy PUT `/api/telemetry/batch` then fallback POST `/api/v2/telemetry/batch`).
- Kept renderer `src/services/telemetry.js` fallback path using axios directly to preserve existing unit test expectations and behavior.
- Preserved unauthorized (401) dispatch event and non-blocking semantics.
- Tests verification:
  - `tests/unit/telemetryService.test.js` → PASS (2/2)
  - `tests/unit/electronTelemetry.test.js` → PASS (2/2)
- Scope limited to telemetry; broader suite still has unrelated failures to address separately.
