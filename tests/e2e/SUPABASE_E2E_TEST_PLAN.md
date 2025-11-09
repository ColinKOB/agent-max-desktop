# Desktop Supabase E2E Test Plan

## Overview

This document outlines the manual and automated E2E tests for validating Supabase integration in the agent-max-desktop application.

## Prerequisites

### Environment Setup

1. **Backend Running**: Ensure Railway backend is deployed with Supabase enabled
   ```bash
   # Verify backend health
   curl https://agentmax-production.up.railway.app/health/supabase
   ```

2. **Desktop Config**: Ensure `.env.production` has Supabase credentials
   ```bash
   VITE_SUPABASE_URL=https://rburoajxsyfousnleydw.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Build Desktop App**: 
   ```bash
   npm run build
   npm run electron:build  # or npm run electron:dev for testing
   ```

## Test Suite

### Test 1: Supabase Client Initialization

**Goal**: Verify desktop app initializes Supabase client correctly

**Steps**:
1. Launch desktop app in dev mode: `npm run electron:dev`
2. Open DevTools (Cmd+Option+I)
3. Check console for initialization messages

**Expected Output**:
```
Supabase client initialized
Memory service using Supabase-first strategy
```

**Pass Criteria**:
- No errors in console
- `SUPABASE_ENABLED` is `true` in `src/services/supabase.js`

**Failure Troubleshooting**:
- Verify `.env.production` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Check network tab for CORS issues
- Verify Supabase project is not paused

---

### Test 2: User Onboarding Flow

**Goal**: Test email/password sign-in and user creation

**Steps**:
1. Launch fresh desktop app (clear app data if needed)
2. Navigate to onboarding screen
3. Enter email: `test-{timestamp}@example.com`
4. Enter password: `TestPassword123!`
5. Click "Sign Up" or "Sign In"
6. Wait for onboarding to complete

**Expected Output**:
- User redirected to main app screen
- Console shows: `User authenticated: <user-id>`
- No errors in console

**Verification**:
```sql
-- In Supabase SQL Editor
SELECT id, email, created_at 
FROM auth.users 
WHERE email LIKE 'test-%@example.com' 
ORDER BY created_at DESC 
LIMIT 5;

SELECT id, device_id, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;
```

**Pass Criteria**:
- User record exists in `auth.users`
- User record exists in `users` table with matching `id`
- Desktop app loads successfully after onboarding

---

### Test 3: Session and Message Storage

**Goal**: Verify sessions and messages are stored in Supabase

**Steps**:
1. In desktop app, open chat interface
2. Send a message: "What is the weather like today?"
3. Wait for AI response
4. Send follow-up: "Thank you"
5. Close and reopen app
6. Verify conversation history persists

**Expected Behavior**:
- Messages appear in chat UI immediately
- On app restart, previous messages load
- Console shows: `Messages loaded from Supabase: <count>`

**Verification**:
```sql
-- Check sessions
SELECT id, title, mode, created_at 
FROM sessions 
ORDER BY created_at DESC 
LIMIT 5;

-- Check messages
SELECT 
  m.id, 
  m.role, 
  LEFT(m.content, 50) as content_preview,
  m.redacted_content IS NOT NULL as has_redaction,
  m.created_at
FROM messages m
JOIN sessions s ON m.session_id = s.id
ORDER BY m.created_at DESC
LIMIT 10;
```

**Pass Criteria**:
- Session exists in `sessions` table
- All messages exist in `messages` table
- `redacted_content` is populated for privacy
- Messages persist across app restarts

---

### Test 4: Response Cache Flow

**Goal**: Test cross-user response cache

**Steps**:
1. In desktop app, ask: "What is the capital of France?"
2. Wait for response
3. Ask the same question again
4. Ask it a third time
5. Check console for cache messages

**Expected Console Output** (after 3rd ask):
```
Question frequency: 3 (min: 3)
Storing in Supabase cache...
Response cached successfully
```

**On Subsequent Ask** (in new session or different user):
```
Checking Supabase cache...
Cache HIT: Using cached response
```

**Verification**:
```sql
-- Check response_cache table
SELECT 
  id,
  prompt_original,
  is_personal,
  hit_count,
  created_at,
  last_hit_at
FROM response_cache
WHERE is_personal = false
ORDER BY created_at DESC
LIMIT 10;

-- Check cache stats
SELECT * FROM v_cache_stats;
```

**Pass Criteria**:
- After 3 asks, entry exists in `response_cache`
- `is_personal` is `false` for generic queries
- `hit_count` increments on subsequent cache hits
- `v_cache_stats` shows entry_count > 0

**Personal Query Test**:
- Ask: "What is my password?" (should mark as personal)
- Verify `is_personal` is `true` in cache table
- Verify it doesn't appear in cross-user cache checks

---

### Test 5: Offline Sync (Supabase Memory Service)

**Goal**: Test offline queue and sync when connection restored

**Steps**:
1. Disable network: Network tab in DevTools → "Offline"
2. Add a memory fact: "My favorite color is blue"
3. Check console for offline queue message
4. Re-enable network
5. Wait for sync

**Expected Output**:
```
Supabase offline - queueing operation
Network restored - syncing 1 queued operations
Sync complete: 1 operations applied
```

**Verification**:
```sql
-- Check facts table
SELECT id, category, key, value, created_at 
FROM facts 
ORDER BY created_at DESC 
LIMIT 10;
```

**Pass Criteria**:
- Offline operation queued locally
- On reconnect, operation syncs to Supabase
- Fact appears in `facts` table
- No data loss

---

### Test 6: Telemetry Events

**Goal**: Verify telemetry events are logged to Supabase

**Steps**:
1. Perform various actions in desktop app:
   - Send a message
   - Open settings
   - Click billing tab
2. Check console for telemetry events
3. Query Supabase for events

**Expected Console Output**:
```
Telemetry event tracked: interaction
Telemetry event tracked: navigation
```

**Verification**:
```sql
-- Check telemetry_events
SELECT 
  event_type,
  action,
  COUNT(*) as count
FROM telemetry_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, action
ORDER BY count DESC;

-- Recent events
SELECT 
  id,
  event_type,
  action,
  metadata,
  created_at
FROM telemetry_events
ORDER BY created_at DESC
LIMIT 20;
```

**Pass Criteria**:
- Telemetry events logged to `telemetry_events` table
- Events have correct `event_type` and `action`
- Metadata contains relevant context

---

### Test 7: Stripe Credits Integration

**Goal**: Test Stripe webhook increments credits in Supabase

**Prerequisites**: 
- Stripe CLI installed: `brew install stripe/stripe-cli/stripe`
- Stripe test mode configured

**Steps**:

1. **Setup Stripe Listener**:
   ```bash
   stripe listen --forward-to https://agentmax-production.up.railway.app/webhooks/stripe
   ```

2. **Get Test User Stripe Customer ID**:
   ```sql
   -- In Supabase SQL Editor
   SELECT id, metadata->>'stripe_customer_id' as stripe_id, metadata->>'credits' as credits
   FROM users 
   WHERE device_id = '<your-test-device-id>';
   ```

3. **Trigger Test Invoice Payment**:
   ```bash
   stripe trigger invoice.payment_succeeded
   ```

4. **Check Backend Logs** (Railway dashboard):
   ```
   User located by stripe_customer_id: cus_...
   Credits incremented: 0 → 100
   Telemetry event logged
   ```

5. **Verify in Supabase**:
   ```sql
   SELECT 
     id, 
     metadata->>'stripe_customer_id' as stripe_id,
     metadata->>'credits' as credits
   FROM users 
   WHERE metadata->>'stripe_customer_id' = 'cus_...';
   
   -- Check telemetry
   SELECT * FROM telemetry_events 
   WHERE action = 'credits_added' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

**Pass Criteria**:
- Webhook received successfully (200 response)
- User credits incremented in `users.metadata.credits`
- Telemetry event logged with `action: credits_added`

---

### Test 8: RLS Policy Verification

**Goal**: Verify Row Level Security prevents unauthorized access

**Note**: This is best tested via Supabase Dashboard with different auth contexts

**Steps**:

1. **Get Anon Key Token**:
   - Copy `VITE_SUPABASE_ANON_KEY` from `.env.production`

2. **Test Anonymous Read** (allowed for some tables):
   ```bash
   curl -X GET \
     'https://rburoajxsyfousnleydw.supabase.co/rest/v1/response_cache?select=*&limit=5' \
     -H "apikey: <ANON_KEY>" \
     -H "Authorization: Bearer <ANON_KEY>"
   ```
   
   **Expected**: Returns cache entries (RLS disabled for response_cache)

3. **Test User Data Isolation** (should fail without auth):
   ```bash
   curl -X GET \
     'https://rburoajxsyfousnleydw.supabase.co/rest/v1/users?select=*' \
     -H "apikey: <ANON_KEY>" \
     -H "Authorization: Bearer <ANON_KEY>"
   ```
   
   **Expected**: Empty array or error (RLS prevents reading other users)

4. **Test with Service Key** (backend only):
   ```bash
   curl -X GET \
     'https://rburoajxsyfousnleydw.supabase.co/rest/v1/users?select=*&limit=5' \
     -H "apikey: <SERVICE_KEY>" \
     -H "Authorization: Bearer <SERVICE_KEY>"
   ```
   
   **Expected**: Returns all users (service key bypasses RLS)

**Pass Criteria**:
- Anon key can read `response_cache` (RLS disabled)
- Anon key cannot read other users' `messages`, `facts`, `preferences`
- Service key can read all data (for backend operations)

---

## Automated Test Suite

For automated E2E testing with Playwright:

```bash
# Run desktop E2E tests
npm run test:e2e:supabase

# Or manually
npx playwright test tests/e2e/supabase-integration.spec.js
```

**Test File**: `tests/e2e/supabase-integration.spec.js`

```javascript
// Example Playwright test structure
test.describe('Supabase Integration', () => {
  test('should initialize Supabase client', async ({ page }) => {
    await page.goto('http://localhost:5173');
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.waitForTimeout(2000);
    expect(logs.some(log => log.includes('Supabase client initialized'))).toBeTruthy();
  });
  
  test('should cache responses after 3 asks', async ({ page }) => {
    // Navigate to chat
    // Ask same question 3 times
    // Verify cache message in console
  });
  
  // Add more tests...
});
```

---

## Test Result Tracking

Use this checklist to track test completion:

- [ ] Test 1: Supabase client initialization
- [ ] Test 2: User onboarding flow
- [ ] Test 3: Session and message storage
- [ ] Test 4: Response cache flow
- [ ] Test 5: Offline sync
- [ ] Test 6: Telemetry events
- [ ] Test 7: Stripe credits integration
- [ ] Test 8: RLS policy verification

---

## Troubleshooting

### Common Issues

**Issue**: "Supabase disabled (missing dependency or credentials)"
- **Fix**: Verify `.env.production` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Fix**: Rebuild app: `npm run build`

**Issue**: CORS errors in network tab
- **Fix**: Verify Supabase project has correct CORS settings in Dashboard → Settings → API
- **Fix**: Ensure `supabase.co` domain is allowed

**Issue**: Cache not working
- **Fix**: Verify question asked 3+ times (minimum frequency)
- **Fix**: Check `is_personal` detection isn't marking query as personal
- **Fix**: Verify `response_cache` table has RLS disabled

**Issue**: Messages not persisting
- **Fix**: Check RLS policies allow user to write to `messages` table
- **Fix**: Verify session exists before storing messages
- **Fix**: Check browser console for Supabase errors

---

## Success Metrics

After completing all tests:

| Metric | Target | Status |
|--------|--------|--------|
| Supabase init success rate | 100% | [ ] |
| User onboarding success | 100% | [ ] |
| Message persistence | 100% | [ ] |
| Cache hit rate (after setup) | >50% | [ ] |
| Offline sync success | 100% | [ ] |
| Telemetry event logging | 100% | [ ] |
| Stripe credits update | 100% | [ ] |
| RLS policy enforcement | 100% | [ ] |

---

## Next Steps After Testing

1. **Monitor in Production**:
   - Check Supabase dashboard for query performance
   - Monitor cache hit rates via `v_cache_stats`
   - Track storage growth in Supabase

2. **Optimize**:
   - Adjust cache TTL based on hit patterns
   - Improve `is_personal` detection algorithm
   - Add more sophisticated telemetry queries

3. **Document Findings**:
   - Update `ProjectOutline/Supabase-Reenable-Checklist.md` with results
   - Note any issues or edge cases discovered
   - Create runbook for common production issues
