# 🔄 Restart Backend and Test Webhook

## ✅ Changes Applied

1. ✅ Simplified Stripe webhook handler created
2. ✅ Router registered in main.py
3. ✅ Webhook endpoint: `/webhooks/stripe`
4. ✅ Webhook secret configured
5. ✅ Webhook listener running

---

## 🚀 Next Steps

### 1. Restart Backend (REQUIRED)

**In the terminal running the backend:**

```bash
# Press Ctrl+C to stop the backend
# Then restart:
cd Agent_Max
source venv/bin/activate
python agent_max.py --api
```

You should see:
```
🚀 Agent Max API starting up...
📚 Documentation: http://localhost:8000/docs
```

**Verify webhook endpoint exists:**
```bash
curl http://localhost:8000/docs
# Look for "/webhooks/stripe" endpoint
```

---

### 2. Re-run Webhook Test

**Terminal 1 - Backend:** (should be running after restart)

**Terminal 2 - Webhook Listener:** (already running)
```bash
stripe listen --forward-to localhost:8000/webhooks/stripe
```

**Terminal 3 - Run Test:**
```bash
cd agent-max-desktop
node test-stripe-webhook.js
```

**Terminal 4 - Trigger Webhook** (when test prompts):
```bash
stripe trigger checkout.session.completed \
  --add 'checkout_session:client_reference_id=<USER_ID_FROM_TEST>' \
  --add 'checkout_session:metadata[credits]=100' \
  --add 'checkout_session:metadata[user_id]=<USER_ID_FROM_TEST>'
```

---

## ✅ Expected Success

### Webhook Listener (Terminal 2):
```
2025-10-21 00:XX:XX   --> checkout.session.completed [evt_...]
2025-10-21 00:XX:XX  <--  [200] POST http://localhost:8000/webhooks/stripe
```

### Backend Logs:
```
📥 Received webhook: checkout.session.completed [evt_...]
✅ Added 100 credits to user {uuid}. New balance: 100
✅ Successfully processed checkout.session.completed
```

### Test Script:
```
✅ SUCCESS! Credits updated: 0 → 100
✅ Telemetry event logged
🎉 WEBHOOK INTEGRATION TEST PASSED!
```

---

## 🐛 If Still Getting 404

### Check 1: Verify endpoint registered
```bash
curl http://localhost:8000/docs | grep webhooks
```

### Check 2: Test endpoint directly
```bash
curl -X POST http://localhost:8000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}'
```

Should return error about missing signature (not 404!)

### Check 3: Backend logs
Look for:
```
"POST /webhooks/stripe HTTP/1.1" 400
```
(400 = signature error, which is expected without valid signature)

NOT:
```
"POST /webhooks/stripe HTTP/1.1" 404
```
(404 = endpoint not found)

---

## 🎯 After Successful Test

Once webhook integration is verified:

1. ✅ **All infrastructure complete!**
2. ⏭️  **Next**: Implement 4 frontend integration tasks
3. ⏭️  **Then**: End-to-end testing
4. ⏭️  **Finally**: Ship it! 🚀

See `IMPLEMENTATION_STATUS.md` for remaining tasks.
