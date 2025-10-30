# 🔧 Stripe Integration Testing Guide

**Status**: ✅ Stripe CLI configured and ready  
**Webhook Secret**: Configured in backend

---

## ✅ Setup Complete

1. ✅ Stripe CLI installed (v1.31.0)
2. ✅ Logged into Stripe (Agent Max account)
3. ✅ Webhook listener started
4. ✅ Webhook secret configured in backend

---

## 🧪 Test Stripe Webhook Integration

### Step 1: Restart Backend (Pick up new webhook secret)

**Terminal 1 - Backend:**
```bash
cd Agent_Max
source venv/bin/activate

# Stop current backend (Ctrl+C if running)
# Then start it again:
python agent_max.py --api
```

### Step 2: Start Webhook Listener

**Terminal 2 - Webhook Listener:**
```bash
cd agent-max-desktop
stripe listen --forward-to localhost:8000/webhooks/stripe
```

You should see:
```
> Ready! Your webhook signing secret is whsec_... (^C to quit)
```

### Step 3: Run Automated Test

**Terminal 3 - Test Script:**
```bash
cd agent-max-desktop
node test-stripe-webhook.js
```

This will:
1. Create a test user in Supabase
2. Wait for you to trigger the webhook
3. Monitor for credit updates
4. Verify the complete flow

### Step 4: Trigger Webhook

When the test script prompts you, run in **Terminal 4**:
```bash
stripe trigger checkout.session.completed
```

The test will automatically detect the webhook, verify credits were added, and confirm telemetry was logged.

---

## 🎯 Expected Results

### ✅ Success Output:
```
🧪 STRIPE WEBHOOK INTEGRATION TEST

1️⃣  Creating test user...
✅ Test user created: {uuid}
   Email: webhook-test@agentmax.com
   Credits: 0

2️⃣  Now trigger Stripe webhook...

3️⃣  Waiting for webhook to process...

✅ SUCCESS! Credits updated: 0 → 100
✅ Telemetry event logged:
   Event: checkout_completed
   Credits purchased: 100
   Amount paid: $10.00

═══════════════════════════════════════
🎉 WEBHOOK INTEGRATION TEST PASSED!
═══════════════════════════════════════

✅ Verified:
   - Webhook received by backend
   - Credits added to Supabase
   - Telemetry event logged
   - Complete flow working!
```

---

## 🔍 Manual Verification (Optional)

### Check Supabase Dashboard

1. Go to: https://app.supabase.com/project/rburoajxsyfousnleydw
2. Navigate to Table Editor → `users`
3. Find the test user
4. Verify `metadata.credits` = 100

### Check Telemetry

1. Table Editor → `telemetry_events`
2. Filter by `event_type` = 'credit_purchase'
3. Verify event was logged with correct metadata

---

## 🐛 Troubleshooting

### Issue: "Webhook signature verification failed"

**Cause**: Backend not using new webhook secret

**Fix**:
```bash
# Verify secret in backend
cd Agent_Max
grep STRIPE_WEBHOOK_SECRET .env

# Should show: whsec_a19d6c5652f7601f4411a43fd34c1063a0ab23edc8304299eceff748fdbca901

# Restart backend
python agent_max.py --api
```

### Issue: "Timeout: Credits not updated"

**Check**:
1. Backend is running: `curl http://localhost:8000/health`
2. Webhook listener is running (Terminal 2)
3. Trigger was executed (Terminal 4)
4. Backend logs for errors

### Issue: "Cannot connect to localhost:8000"

**Fix**:
```bash
cd Agent_Max
source venv/bin/activate
python agent_max.py --api
```

---

## 📊 Test with Different Credit Packages

After basic test passes, test different packages:

### Starter Package (100 credits)
```bash
stripe trigger checkout.session.completed \
  --add checkout_session:metadata[credits]=100 \
  --add checkout_session:amount_total=1000
```

### Pro Package (500 credits)
```bash
stripe trigger checkout.session.completed \
  --add checkout_session:metadata[credits]=500 \
  --add checkout_session:amount_total=4000
```

### Unlimited Package (1000 credits)
```bash
stripe trigger checkout.session.completed \
  --add checkout_session:metadata[credits]=1000 \
  --add checkout_session:amount_total=7000
```

---

## 🎯 Next Steps After Successful Test

Once webhook integration is verified:

1. ✅ **Implement Task 1**: User initialization (`src/App.jsx`)
2. ✅ **Implement Task 2**: Add CreditDisplay to FloatBar
3. ✅ **Implement Task 3**: Credit check in message send
4. ✅ **Implement Task 4**: Purchase modal
5. ✅ **Test end-to-end**: Complete user flow

See `IMPLEMENTATION_STATUS.md` for detailed task instructions.

---

## 📝 Current Test Status

- [ ] Backend restarted with new webhook secret
- [ ] Webhook listener running
- [ ] Test script executed
- [ ] Webhook triggered
- [ ] Credits verified in Supabase
- [ ] Telemetry verified

**Mark items as you complete them!**
