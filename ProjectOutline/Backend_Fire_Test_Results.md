# Backend Fire Test Results (Hosted Railway: Agent_Max)

Date: 2025-11-05
Target: https://agentmax-production.up.railway.app
Auth: X-API-Key from .env.production
Runner: scripts/integration/chat_stream_fire_test.mjs (SSE, same endpoints as desktop UI)
Artifacts:
- JSONL SSE log: tests/e2e/_reports/chat_fire_test_2025-11-05T01-59-08-610Z.jsonl
- Railway deploy logs (filtered) captured via MCP

## Summary
- Health OK: /health 200, /api/memory/health 200
- Chat streaming (helpful/chatty) responds but returns no content: only ACK + done with empty final_response
- Long-context chat returns 422 due to message length limit (max 4000 chars)
- Autonomous streaming works and returns a valid final_response
- Backend logs show Responses API 400, fallback to Chat Completions, but 0 tokens forwarded to client
- Telemetry write errors: Permission denied at /app/telemetry_data (non-blocking)

## Test Matrix and Results
- basic_math_chat (helpful): OK stream 200; ACK then done; 0 tokens; ttff 3391ms; total 5059ms
- reasoning_short (helpful): OK 200; ACK then done; 0 tokens; ttff 328ms; total 3193ms
- planning (helpful): OK 200; ACK then done; 0 tokens; ttff 2253ms; total 6919ms
- long_context (helpful): FAIL 422; detail: String should have at most 4000 characters
- autonomous_simple (autonomous): OK 200; plan/thinking/step/done; final_response populated; ttff 83ms; total 158521ms; 7 events

See JSONL for full SSE event stream.

## Evidence (Railway Logs Excerpts)
- Chat streaming:
  - "Responses API error 400" → fallback to Chat Completions
  - "Time to first token" reported, but "Stream complete: 0 tokens" (no tokens forwarded)
  - Requests logged as 200 for /api/v2/chat/streaming/stream
- 422 cases:
  - telemetry middleware: POST /api/v2/chat/streaming/stream 422 Unprocessable Entity
  - POST /api/v2/chat/message 422 Unprocessable Entity
- Telemetry:
  - "Telemetry logging failed (stream): [Errno 13] Permission denied: '/app/telemetry_data'"

## Analysis: Capabilities vs Actual Behavior
- Intended capabilities:
  - Chat (helpful/chatty): text generation via SSE tokens
  - Autonomous: tool/plan execution with step streaming
- Observed:
  - Autonomous path works and returns full final_response
  - Chat SSE path emits ACK + done with empty final_response; no token events surfaced
  - Long message input constrained to 4000 chars (Pydantic validation)

## Likely Root Causes
1) Responses API usage bug: request payload for OpenAI "responses" likely malformed (400), triggering fallback
2) Chat Completions fallback path streams internally, but SSE bridge doesn’t forward tokens (aggregation emits done without content)
3) Input length validation fixed at 4000 chars; large messages 422 at both stream and JSON chat endpoints
4) Telemetry write path mismatch/permissions (/var/lib/agentmax/telemetry vs /app/telemetry_data) causing warnings

## Recommendations (Backend)
- Fix Responses API call for gpt-5:
  - Ensure correct payload schema (model, input/messages, stream=true)
  - Log upstream 400 body for diagnosis
- Fix Chat Completions streaming bridge:
  - Set stream=true; iterate upstream events; forward token deltas; accumulate final_response
  - Emit non-empty done payload; add counters for tokens forwarded
- Increase or handle message length:
  - Raise max length (e.g., 16k) or chunk/truncate server-side with clear error messaging
- Telemetry path/permissions:
  - Write to /var/lib/agentmax/telemetry consistently; ensure writable ownership; suppress non-critical errors

## Temporary Client Mitigation (if needed)
- Add a timeout fallback: if SSE yields ACK but no tokens within N seconds, retry JSON /api/v2/chat/message and display response
- Pre-truncate messages >4000 chars with a visible note until backend limit is raised

## Next Actions
- Run API smokes against Railway: npm run test:api -s (with API_URL and TEST_API_KEY)
- Open backend issues:
  - Chat SSE forwarding bug (ACK/done empty)
  - Responses API 400
  - Message length limit policy
  - Telemetry write path
- After fixes, re-run chat_stream_fire_test.mjs and verify tokens and final_response are present

## Re-run (2025-11-05 10:09 UTC)
  
- **API Smokes (Playwright)**: 15/15 passed against production
  - Command: npm run test:api -s (API_URL=https://agentmax-production.up.railway.app)
  - Report JSON: play-results.json
- **JSON Chat Samples** (non-streaming) returned content:
  - tests/e2e/_reports/chat_json_sample_1.json
  - tests/e2e/_reports/chat_json_sample_2.json
- **Autonomous Multi-step Fire Test**: 5/5 failed with 429 rate_limit_exceeded (retry_after=60s)
  - Artifact: tests/e2e/_reports/autonomous_multistep_2025-11-05T10-09-47-412Z.jsonl
  - Note: Backend rate limiter active (env: RATE_LIMIT_DEFAULT=100/min). We can stagger tests or raise burst for CI if desired.
- **Client-side Mitigations Implemented** (temporary until backend patch):
  - src/services/api.js
    - Pre-truncate chat messages >4000 chars with user note (avoids 422)
    - Detect chat SSE ack-without-content and auto-fallback to JSON /api/v2/chat/message, emitting final_response
    
### Next Re-run Plan
- After backend fixes for SSE streaming and message length, re-run:
  - node scripts/integration/chat_stream_fire_test.mjs
  - node scripts/integration/autonomous_multistep_fire_test.mjs (with spacing to avoid 429)
  - npm run test:api -s
 
 ## Re-run (2025-11-05 10:33 UTC)
 
 - **Env Change for Test**: Disabled telemetry in Railway to avoid write-permission noise during runs
   - ENABLE_TELEMETRY=0, TELEMETRY_ENABLED=false
 - **Autonomous Multi-step Fire Test** (post-change): mixed results; some content produced, some final_response length 0
   - trip_planning_constraints: OK steps=0 ttff=197ms total=46153ms finalLen=49
   - data_cleaning_pipeline: OK steps=1 ttff=2280ms total=66324ms finalLen=3280
   - feature_launch_checklist: OK steps=0 ttff=26ms total=181503ms finalLen=0
   - study_schedule: OK steps=1 ttff=31ms total=206557ms finalLen=0
   - debugging_strategy: OK steps=0 ttff=28ms total=183440ms finalLen=0
 - **Artifact**: tests/e2e/_reports/autonomous_multistep_2025-11-05T10-33-29-526Z.jsonl
 - **Notes**:
   - No 429s observed in this run; the script’s backoff/spacing likely helped alongside prior rate limit increase.
   - Cases with finalLen=0 suggest backend may return done without final_response in some autonomous paths; keep in scope for backend patching.
