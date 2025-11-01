# Telemetry Pipeline (Beta)

This release adds an always-on telemetry broker so packaged desktop builds push
real-world diagnostics back to the Agent Max team as soon as a tester installs
and launches the app. The system stitches together renderer and main-process
events, batches them, and forwards everything to the backend endpoint you
configure at build time.

## What gets collected

- `app.lifecycle.install` (first boot) with host hardware snapshot and
  anonymised machine identifier
- `app.lifecycle.launch` / `before-quit` plus open window counts
- All `electron-log` entries and intercepted `console.*` output from the main
  process
- Renderer events and errors sent through `src/services/telemetry.js`, now
  bridged automatically through IPC instead of direct axios calls

## Configuration knobs

Set these environment variables before packaging or distributing builds:

- `TELEMETRY_API` (or `VITE_TELEMETRY_API`) – base URL for the Railway backend
- `TELEMETRY_API_KEY` (or `VITE_TELEMETRY_API_KEY`) – shared secret header
- `TELEMETRY_BATCH_SIZE`, `TELEMETRY_FLUSH_INTERVAL_MS` – optional overrides
  for queue behaviour
- `TELEMETRY_DISABLED=true` – stop collection entirely (useful for local
  debugging)
- `TELEMETRY_MACHINE_ID` – testing override for deterministic machine IDs

The renderer service will reuse these settings automatically through the
`window.telemetry` bridge, so no additional wiring is required in React.

## Verifying the pipeline

1. Run the focused unit suite: `npm run test -- tests/unit/telemetryService.test.js
   tests/unit/electronTelemetry.test.js`
2. Launch the desktop build with `TELEMETRY_API` / `TELEMETRY_API_KEY` pointing
   at your staging endpoint and confirm that `app.lifecycle.*` events arrive.
3. Trigger an error in the UI — the renderer service will pipe it through the
   main-process queue so the backend sees both the rich context and the
   correlated console output.

This flow ensures every beta download will emit the telemetry payloads needed
to monitor crashes, suspicious logs, and high-value usage metrics in near
real-time.
