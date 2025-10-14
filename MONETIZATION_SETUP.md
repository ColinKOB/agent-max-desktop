# 💰 Agent Max Monetization Setup Guide

## Overview

This guide will help you set up Stripe subscriptions for Agent Max.

---

## 🎯 Pricing Strategy Recommendation

### Free Tier
- 100 AI requests per month
- Basic features
- Community support
- **Goal:** Let users try before they buy

### Pro Tier ($19/month)
- Unlimited AI requests
- Screen control
- Google services
- Priority support
- **Target:** Power users, professionals

### Enterprise Tier ($49/month)
- Everything in Pro
- API access
- Custom integrations
- Team features
- **Target:** Businesses, teams

---

## 📋 Step-by-Step Setup

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for an account
3. Complete business verification
4. Get your API keys

### Step 2: Create Products in Stripe Dashboard

**Create "Agent Max Pro" Product:**
1. Dashboard → Products → Add Product
2. Name: "Agent Max Pro"
3. Description: "Unlimited AI requests, screen control, Google services"
4. Pricing: $19/month (recurring)
5. Copy the **Price ID** (looks like `price_1234...`)

**Create "Agent Max Enterprise" Product:**
1. Dashboard → Products → Add Product
2. Name: "Agent Max Enterprise"
3. Description: "Everything in Pro + API access + team features"
4. Pricing: $49/month (recurring)
5. Copy the **Price ID**

### Step 3: Configure Environment Variables

Create `.env` file in Agent_Max backend:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51ABC...  # Your secret key
STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...  # Your publishable key
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook signing secret

# Price IDs from Step 2
STRIPE_PRICE_PRO=price_1234...
STRIPE_PRICE_ENTERPRISE=price_5678...
```

### Step 4: Add Stripe to Backend

**Install Stripe SDK:**
```bash
cd /path/to/Agent_Max
./venv/bin/pip install stripe
```

**Add to `requirements.txt`:**
```
stripe>=5.0.0
```

**Register the router in `main.py`:**
```python
from api.routers import subscription

app.include_router(
    subscription.router,
    prefix="/api/v2/subscription",
    tags=["subscription"]
)
```

### Step 5: Set Up Webhooks

**Why webhooks?**
- Get notified when subscriptions change
- Handle payment failures
- Process cancellations
- Send receipts

**Setup:**
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-api.com/api/v2/subscription/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Webhook Secret** → Add to `.env`

### Step 6: Test in Development

**Use Stripe Test Mode:**
```bash
# Test card numbers
4242 4242 4242 4242  # Success
4000 0000 0000 9995  # Decline

# Any future expiry date
# Any 3-digit CVC
```

**Test the flow:**
1. Start backend: `./venv/bin/python agent_max.py --api`
2. Start frontend: `npm run electron:dev`
3. Go to Settings → Subscription
4. Click "Upgrade to Pro"
5. Use test card
6. Verify subscription activates

---

## 🔒 Security Best Practices

### Never Expose Secret Keys
```javascript
// ❌ WRONG - Never do this
const stripe = Stripe('sk_test_SECRET_KEY');

// ✅ CORRECT - Keep secrets on backend
// Frontend only gets checkout URL
```

### Use Environment Variables
```bash
# .env (NEVER commit this file!)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Add to .gitignore
```
.env
.env.local
*.pem
*.key
```

---

## 💡 Feature Gating

### Enforce Limits Based on Plan

**Backend middleware:**
```python
# api/middleware/subscription.py
async def check_subscription(email: str, feature: str):
    """Check if user's plan allows this feature"""
    status = await get_subscription_status(email)
    
    if feature == "screen_control":
        return status["plan"] in ["pro", "enterprise"]
    
    if feature == "unlimited_requests":
        return status["plan"] in ["pro", "enterprise"]
    
    if feature == "api_access":
        return status["plan"] == "enterprise"
    
    return False
```

**Usage in endpoints:**
```python
@router.post("/screen/screenshot")
async def take_screenshot(email: str):
    # Check if user has screen control feature
    if not await check_subscription(email, "screen_control"):
        raise HTTPException(
            status_code=403,
            detail="Screen control requires Pro or Enterprise plan"
        )
    
    # Proceed with screenshot...
```

### Frontend Feature Flags

```javascript
// Check subscription before showing features
const { subscription } = useSubscription();

{subscription?.plan === 'pro' || subscription?.plan === 'enterprise' ? (
  <ScreenControlSettings />
) : (
  <UpgradePrompt feature="Screen Control" />
)}
```

---

## 📊 Analytics & Tracking

### Track Key Metrics

**Important metrics:**
- Monthly Recurring Revenue (MRR)
- Churn rate
- Conversion rate (free → paid)
- Average revenue per user (ARPU)

**Stripe Dashboard provides:**
- Revenue charts
- Customer lifetime value
- Subscription analytics
- Payment success rates

### Custom Analytics

```python
# Track conversions
@router.post("/create-checkout")
async def create_checkout_session(request: CreateCheckoutRequest):
    # ... create checkout ...
    
    # Log conversion attempt
    analytics.track('checkout_started', {
        'email': request.email,
        'plan': request.plan,
        'timestamp': datetime.now()
    })
    
    return {"checkout_url": checkout_session.url}
```

---

## 🚀 Going Live

### Pre-Launch Checklist

- [ ] Test all payment flows
- [ ] Test subscription upgrades/downgrades
- [ ] Test cancellation flow
- [ ] Verify webhook handling
- [ ] Set up email notifications
- [ ] Create terms of service
- [ ] Create privacy policy
- [ ] Create refund policy
- [ ] Test with real card (small amount)
- [ ] Monitor Stripe logs

### Switch to Live Mode

1. **Get live API keys:**
   - Stripe Dashboard → Developers → API keys
   - Toggle "View test data" OFF
   - Copy live keys

2. **Update .env:**
   ```bash
   STRIPE_SECRET_KEY=sk_live_...  # Live key
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

3. **Create live products:**
   - Recreate products in live mode
   - Update price IDs in .env

4. **Set up live webhooks:**
   - Point to production URL
   - Update webhook secret

### Launch Strategy

**Week 1: Soft Launch**
- Offer to beta users
- Monitor for issues
- Collect feedback

**Week 2-4: Public Launch**
- Announce on social media
- Email existing users
- Offer launch discount (optional)

**Ongoing:**
- Monitor metrics weekly
- Respond to support quickly
- Iterate based on feedback

---

## 💬 Customer Support

### Common Questions

**"How do I cancel?"**
→ Settings → Subscription → Manage Billing → Cancel

**"Do I get a refund?"**
→ Define your refund policy (30-day recommended)

**"Can I upgrade/downgrade?"**
→ Yes, changes take effect immediately (prorated)

**"What payment methods do you accept?"**
→ All major credit cards via Stripe

### Support Channels

1. **Email:** support@agentmax.app
2. **In-app:** Help button → Contact Support
3. **Documentation:** docs.agentmax.app
4. **FAQ:** agentmax.app/faq

---

## 📈 Optimization Tips

### Increase Conversions

1. **Free trial:** Offer 14-day free trial
   ```python
   trial_period_days=14
   ```

2. **Annual billing:** Offer discount for yearly
   - $19/mo → $190/year (save $38)

3. **Usage-based pricing:** Show value
   - "You've used 95/100 free requests"
   - "Upgrade for unlimited"

4. **Social proof:** Show subscriber count
   - "Join 1,000+ Pro users"

### Reduce Churn

1. **Failed payment recovery:**
   - Email before card expires
   - Retry failed payments
   - Update payment method prompt

2. **Exit surveys:**
   - Ask why they're cancelling
   - Offer discount to stay

3. **Feature announcements:**
   - Email about new features
   - Show value of subscription

---

## 🎁 Promotional Strategies

### Discount Codes

**Create in Stripe:**
1. Dashboard → Products → Coupons
2. Create coupon: `LAUNCH50` (50% off first month)
3. Users enter at checkout

### Referral Program

**Give credits for referrals:**
- Referrer: 1 month free
- Referee: 20% off first month

### Seasonal Promotions

- Black Friday: 40% off annual
- New Year: 3 months for price of 2
- Birthday month: Special offer

---

## 📝 Legal Requirements

### Required Pages

1. **Terms of Service**
   - What users can/can't do
   - Subscription terms
   - Cancellation policy

2. **Privacy Policy**
   - What data you collect
   - How you use it
   - GDPR compliance

3. **Refund Policy**
   - 30-day money-back guarantee (recommended)
   - How to request refund

### Tax Compliance

**Stripe Tax (recommended):**
- Automatically calculates sales tax
- Handles VAT, GST, etc.
- Files tax returns

**Enable in Stripe:**
1. Dashboard → Settings → Tax
2. Enable Stripe Tax
3. Configure tax settings

---

## 🔧 Troubleshooting

### "Payment failed"
- Check Stripe logs
- Verify webhook is receiving events
- Test with different card

### "Subscription not updating"
- Check webhook secret is correct
- Verify endpoint is accessible
- Check server logs

### "Checkout not opening"
- Verify price IDs are correct
- Check API keys are set
- Test in browser console

---

## 📞 Next Steps

1. **Set up Stripe account** (30 min)
2. **Create products** (15 min)
3. **Configure .env** (5 min)
4. **Test checkout flow** (20 min)
5. **Set up webhooks** (15 min)
6. **Test cancellation** (10 min)
7. **Write legal pages** (2 hours)
8. **Launch!** 🚀

---

## 🎯 Success Metrics

**Month 1 Goals:**
- 10 paying customers
- $190 MRR
- <5% churn

**Month 3 Goals:**
- 50 paying customers
- $950 MRR
- 10% conversion rate

**Month 6 Goals:**
- 200 paying customers
- $3,800 MRR
- Profitable

---

**You're ready to monetize Agent Max!** 💰

Start with test mode, perfect the flow, then go live. Good luck! 🚀
