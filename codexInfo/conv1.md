Conversation Notes — Telemetry + Feature Flags (conv1)

Objectives
- Make it easy to collect real-world logs from the desktop app during beta.
- Ensure backend + desktop work together without brittle assumptions.

What We Implemented
- Desktop:
  - Main-process telemetry broker (electron/telemetry.cjs) that batches and forwards events.
  - Renderer telemetry client wired to the broker with IPC fallback to direct HTTP.
  - Unit tests confirming event routing and IPC handshake.
- Backend:
  - Feature-flag endpoint returns structured JSON (flags + rollout_info).
  - Telemetry router updated to accept PUT/POST and both payload shapes (modern + legacy), with improved API-key handling.

What Worked
- Feature flags now return the correct structure in production.
- Desktop telemetry unit tests pass locally.

Remaining Step
- Production telemetry endpoint still reflects legacy behavior (expects {"value":{...}} and rejects modern shape). This indicates the container hasn’t picked up the latest telemetry router code.

How to Verify After Redeploy
1) Run curl with single-line JSON and API key:
   curl -X PUT https://agentmax-production.up.railway.app/api/telemetry/batch \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $API_KEY" \
     --data '{"events":[{"type":"custom_event","userId":"curl","sessionId":"curl","timestamp":"2025-11-01T12:00:00Z","eventName":"curl.smoke","properties":{"source":"curl"}}]}'
2) Expect {"success": true, ...}; check Railway logs for telemetry_batch_ingested.

If It Still Fails
- Temporarily set TELEMETRY_API_KEY to equal API_KEY in Railway variables.
- If the error is "Field required: value", the old router is still live. Redeploy the commit containing `_parse_batch_payload` and try again.

Non-Goals
- Don’t weaken security (keep API key checks). Only use the mirror-key workaround during the beta if necessary.

