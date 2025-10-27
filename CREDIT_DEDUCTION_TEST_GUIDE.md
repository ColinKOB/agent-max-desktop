# Credit Deduction System - Test Guide

## 🎯 What Was Fixed

The credit deduction system has been updated to:
1. **Deduct credits AFTER AI response** (not before)
2. **Calculate based on token usage**: 1 credit per 500 output tokens
3. **Handle errors gracefully** without blocking the user
4. **Provide detailed feedback** via toast notifications

## 🔧 Changes Made

### File Modified: `src/components/FloatBar/AppleFloatBar.jsx`

#### 1. Added Token Tracking (Line 288-339)
```javascript
// Track token usage for credit calculation
let totalOutputTokens = 0;

// In token event handler:
// Track tokens for credit calculation (approximate: ~4 chars per token)
totalOutputTokens += Math.ceil(content.length / 4);
```

#### 2. Moved Credit Deduction to 'done' Event (Lines 569-632)
- Credits now deducted AFTER response completes
- Calculation: `Math.ceil(totalOutputTokens / 500)`
- Shows toast: "X credit(s) used (Y tokens)"

#### 3. Updated `continueSend` Function (Lines 654-692)
- Removed upfront credit deduction
- Only checks balance (doesn't deduct)
- Logs message initiation for telemetry

#### 4. Enhanced Error Handling (Lines 616-632)
- PGRST116: User record not found
- Metadata errors: Invalid structure
- 500 errors: Database server error
- Generic fallback for other errors

## 🧪 Manual Testing Steps

### Test 1: Basic Credit Deduction
1. Open the app and ensure you have credits (check top-right corner)
2. Send a message: "Write me a short story"
3. Wait for the AI response to complete
4. **Expected**: 
   - See toast notification: "X credit(s) used (Y tokens)"
   - Credits deducted based on response length
   - ~250 tokens ≈ 1 credit
   - ~750 tokens ≈ 2 credits

### Test 2: Token Calculation Accuracy
1. Send a very short message: "Hi"
2. **Expected**: 1 credit deducted (even if < 500 tokens)
3. Send a longer message: "Explain quantum physics in detail"
4. **Expected**: Multiple credits deducted based on response length

### Test 3: Error Handling
1. Disconnect from internet (to simulate network error)
2. Send a message
3. **Expected**: Error toast but app doesn't crash
4. Reconnect and verify credits weren't deducted for failed request

### Test 4: Credit Balance Check
1. View your credit balance (top-right corner)
2. Send multiple messages
3. **Expected**: 
   - Balance decreases after each response
   - Accurate deduction based on tokens
   - Toast shows exact token count

### Test 5: Zero Credits Scenario
1. Set your credits to 0 (via database or multiple requests)
2. Try to send a message
3. **Expected**: 
   - Error toast: "No credits remaining!"
   - Settings modal opens (if available)
   - Message not sent

## 📊 Monitoring & Debugging

### Browser Console Logs
Look for these log messages:
```
[Credits] Output tokens: 750, deducting 2 credit(s)
[Credits] Deducted 2: 10 → 8
```

### Supabase Telemetry
Check `telemetry_events` table for:
```json
{
  "event_type": "credit_usage",
  "action": "tokens_consumed",
  "metadata": {
    "output_tokens": 750,
    "credits_deducted": 2,
    "credits_remaining": 8
  }
}
```

### Error Scenarios
If you see errors, check the console for:
- `[Credits] User record not found in database` → Sign in again
- `[Credits] Invalid metadata structure` → Contact support
- `[Credits] Database server error` → Temporary issue
- `[Credits] Failed to deduct credits` → Generic error

## 🎯 Success Criteria

✅ Credits deducted AFTER response (not before)  
✅ Calculation based on actual tokens (1 per 500)  
✅ Toast shows token count and credits deducted  
✅ No 500 errors blocking user  
✅ Graceful error handling with helpful messages  
✅ Telemetry logs token usage accurately  

## 🐛 Known Issues & Solutions

### Issue: No credits deducted
**Solution**: Check browser console for errors. Verify user is logged in.

### Issue: Wrong credit amount
**Solution**: Check token calculation. ~4 chars per token, 1 credit per 500 tokens.

### Issue: 500 errors
**Solution**: These should now be caught and logged. Check:
1. User record exists in database
2. Metadata structure is valid
3. Database connection is stable

## 📝 Testing Checklist

- [ ] Short response (< 500 tokens) → 1 credit
- [ ] Medium response (500-1000 tokens) → 2 credits
- [ ] Long response (> 1000 tokens) → 3+ credits
- [ ] Error handling doesn't block UI
- [ ] Toast notifications appear
- [ ] Credit balance updates correctly
- [ ] Telemetry logs are accurate
- [ ] Works with cached responses (0 credits)

## 🎬 Next Steps

1. **Test the implementation** using this guide
2. **Monitor the logs** during testing
3. **Verify telemetry** in Supabase dashboard
4. **Report any issues** with console logs attached

---

**Changes implemented on**: Current session  
**Files modified**: `src/components/FloatBar/AppleFloatBar.jsx`  
**Testing priority**: HIGH - Critical billing feature
