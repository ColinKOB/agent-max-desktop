
# 🔑 API Keys Configuration Status

**IMPORTANT**: Review and update before production deployment

---

## ✅ CONFIGURED & WORKING

### 1. **OpenAI API** 
**Location**: `Agent_Max/.env`
```
OPENAI_API_KEY=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
```
**Status**: ✅ Real production key

### 2. **Supabase**
**Backend**: `Agent_Max/.env`
```
SUPABASE_URL=https://rburoajxsyfousnleydw.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Frontend**: `agent-max-desktop/.env`
```
VITE_SUPABASE_URL=https://rburoajxsyfousnleydw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Status**: ✅ Real production keys

### 3. **Google OAuth**
**Location**: `Agent_Max/.env`
```
GOOGLE_OAUTH_CLIENT_ID=982244014127-cqsup2e3hoskk35l5imtib40luq08lvt.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=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
```
**Status**: ✅ Real production credentials

### 4. **Stripe Webhook Secret** (Local Testing)
**Location**: `Agent_Max/.env`
```
STRIPE_WEBHOOK_SECRET=whsec_a19d6c5652f7601f4411a43fd34c1063a0ab23edc8304299eceff748fdbca901
```
**Status**: ✅ Valid for local testing with Stripe CLI

---

## ⚠️ NEEDS PRODUCTION KEYS

### 1. **Stripe Secret Key (Backend)**
**Location**: `Agent_Max/.env`
**Current**: 
```
STRIPE_SECRET_KEY=sk_test_your_secret_key_here  ❌ PLACEHOLDER
```
**Action Required**: 
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_live_` in production)
3. Update in `.env`

### 2. **Stripe Publishable Key (Frontend)**
**Location**: `agent-max-desktop/.env`
**Current**: 
```
VITE_STRIPE_PUBLISHABLE_KEY=  ❌ EMPTY
```
**Action Required**:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Publishable key** (starts with `pk_live_` in production)
3. Update in `.env`

### 3. **Stripe Webhook Secret (Production)**
**For Production Deployment**:
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-backend-domain.railway.app/webhooks/stripe`
3. Select events: `checkout.session.completed`
4. Copy the signing secret (starts with `whsec_`)
5. Update in backend `.env`

---

## 📋 Quick Setup Commands

### Get Your Stripe Keys:
```bash
# Open Stripe Dashboard
open https://dashboard.stripe.com/apikeys

# Test mode keys (for development):
# - Secret key: sk_test_...
# - Publishable key: pk_test_...

# Live mode keys (for production):
# - Secret key: sk_live_...
# - Publishable key: pk_live_...
```

### Update Backend (.env):
```bash
cd Agent_Max

# Edit .env and update:
# STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY  # For testing
# or
# STRIPE_SECRET_KEY=sk_live_YOUR_ACTUAL_KEY  # For production
```

### Update Frontend (.env):
```bash
cd agent-max-desktop

# Edit .env and update:
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY  # For testing
# or
# VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_KEY  # For production
```

---

## 🧪 Testing vs Production

### For Local Testing:
- Use `sk_test_...` and `pk_test_...` keys
- Test card: `4242 4242 4242 4242`
- Use Stripe CLI for webhooks

### For Production:
- Use `sk_live_...` and `pk_live_...` keys
- Configure webhook endpoint in Stripe Dashboard
- Enable real payment methods

---

## ✅ Verification Steps

After updating keys:

1. **Test Backend Connection**:
```bash
curl http://localhost:8000/api/v2/credits/packages
# Should return credit packages without error
```

2. **Test Frontend Purchase Flow**:
- Open app
- Click on credit display
- Select package
- Should redirect to Stripe Checkout

3. **Test Webhook** (if using test keys):
```bash
stripe listen --forward-to localhost:8000/webhooks/stripe
stripe trigger checkout.session.completed
```

---

## 🔒 Security Notes

- **NEVER** commit API keys to Git
- `.env` files are in `.gitignore` ✅
- Use environment variables in production
- Rotate keys regularly
- Use separate keys for development/production

---

## 📝 Current Status Summary

| Service | Development | Production |
|---------|------------|------------|
| OpenAI | ✅ Real key | ✅ Same key |
| Supabase | ✅ Configured | ✅ Same keys |
| Google OAuth | ✅ Configured | ✅ Same keys |
| Stripe Secret | ❌ Placeholder | ❌ Needs key |
| Stripe Public | ❌ Empty | ❌ Needs key |
| Stripe Webhook | ✅ Local only | ❌ Needs setup |

**Action Required**: Only Stripe keys need to be configured for production!
