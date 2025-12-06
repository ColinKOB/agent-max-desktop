# Desktop Embeddings and Credits Fix (2025-11-09)

## Summary
- Fixed client-side embeddings failing with `@xenova/transformers` under Vite/Electron ("no available backend found").
- Hardened Supabase credits deduction to avoid runtime errors when `users.metadata` is null or user row is missing.

## Changes
- src/services/embeddings.js
  - Configured ONNX WASM backend for browsers/Electron:
    - `env.backends.onnx.wasm.numThreads = 1` (avoid SharedArrayBuffer requirement).
    - `env.backends.onnx.wasm.simd = true` with retry that disables SIMD on failure.
    - `env.backends.onnx.wasm.wasmPaths` set to Xenova CDN (`@xenova/transformers@2.17.1/dist/`).
    - Enabled `env.useBrowserCache = true`.
  - Added retry path to reload the pipeline with SIMD disabled if first attempt fails.

- src/components/FloatBar/AppleFloatBar.jsx (credits section)
  - Switched to `.maybeSingle()` when reading `users.metadata`.
  - Guarded against null `userData`/`metadata` and safely merged metadata.
  - Improved logging on fetch failures; deduction skips gracefully instead of throwing.

## Observed Issues in Logs (Before Fix)
- Embeddings: `no available backend found` from transformers.js while loading `all-MiniLM-L6-v2`.
- Hybrid search: local semantic step fails, cascading to 0 results.
- Supabase credits: `Cannot read properties of null (reading 'metadata')` following a 406 from REST API.
- Memory extract: `/api/v2/memory/extract` 501 (not implemented) then legacy `/api/memory/extract` 429 rate limit.

## Testing Instructions (E2E)
1. Embeddings/Hybrid Search
   - Start dev: `npm run electron:dev`.
   - In FloatBar, ensure `use_hybrid_search` localStorage is not `0` (default true).
   - Type a query that previously triggered embeddings (e.g., long contextual query).
   - Expect: model loads successfully (one-time) and hybrid search returns results. Logger shows load timing, no backend error.

2. Credits Deduction
   - Ensure `localStorage.user_id` is present. If using Supabase, sign in so `users` row exists.
   - Send a prompt with streaming output.
   - Expect: no runtime errors, logs show credits calculated and an update request. If `users` row is missing or blocked by RLS, it will log a warning and skip without breaking UX.

3. Memory Extract (Known Behavior)
   - If `/api/v2/memory/extract` returns 501, the legacy fallback may 429 in production. Current UI surfaces the rate-limit message and continues gracefully.
   - Next steps (optional hardening): add backoff/circuit-breaker on 429 and only attempt legacy fallback on 404/405 to avoid hammering the legacy path.

## Next Steps
- Optional: Implement backoff in `memoryAPI.extract` for 429 (use `retry_after`) and gate legacy fallback when v2 returns 501.
- Optional: Add a small UI notice when semantic search is in pure keyword mode due to embeddings unavailability (now unlikely after this fix).

## Verification
- Unit: N/A (runtime config changes). Consider adding a light smoke to validate `env.backends.onnx.wasm` initialization.
- E2E: run `npm run test:e2e` once backend is stable; check hybrid search and streaming flows.

## Rollback
- Revert `src/services/embeddings.js` and `AppleFloatBar.jsx` hunks if any regressions are observed.
