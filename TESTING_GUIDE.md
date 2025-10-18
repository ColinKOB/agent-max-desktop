# Testing Guide - Phase 1 WebSocket Stub

**Status:** Ready for manual testing  
**Date:** October 18, 2025

---

## Quick Test Instructions

### Backend Test (Already Passing ✅)

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
python3 tests/test_websocket_stub.py
# Expected: 🎉 Test PASSED!
```

### Frontend Manual Test

**Option 1: Test in Browser (Recommended)**

1. **Start Backend:**
   ```bash
   cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
   uvicorn api.main:app --reload
   ```

2. **Start Frontend:**
   ```bash
   cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
   npm run dev
   ```

3. **Open Test Page:**
   - Navigate to: `http://localhost:5173/autonomous-test.html`
   - Or modify `index.html` to import the test component

4. **Test Flow:**
   - Click "Connect to Backend" → Should see 🟢 Connected
   - Enter a goal (default is fine)
   - Click "Start Conversation"
   - Watch 3 steps execute automatically
   - Should see "🎉 Conversation Complete!"

**Option 2: Full Electron App**

1. **Start Backend** (same as above)

2. **Start Electron:**
   ```bash
   cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
   npm run electron:dev
   ```

3. **Access Test:**
   - Need to add route or navigate to test component
   - Or integrate into existing UI

---

## What to Look For

### ✅ Success Indicators

1. **Connection:**
   - Status shows "🟢 Connected"
   - No errors in console

2. **Execution:**
   - 3 steps appear (browser.open, browser.fill, screenshot)
   - Each step shows ⏳ → ✅
   - 500ms delay between steps (simulated execution)
   - Step details show action type and args

3. **Completion:**
   - All steps marked "success"
   - Final message: "🎉 Conversation Complete!"
   - Status shows "complete"

### ❌ Error Indicators

1. **Connection Failed:**
   - Status shows "🔴 Disconnected"
   - Error message with details
   - Check backend is running on port 8000

2. **Execution Failed:**
   - Step shows "❌ failed"
   - Error details in UI
   - Check browser console for details

3. **WebSocket Issues:**
   - Disconnection during execution
   - Check WebSocket URL in console
   - Verify CORS settings

---

## Console Output

### Backend Console (Expected)
```
[WebSocket] Client connected at 2025-10-18T...
[WebSocket] INIT received - Goal: Test autonomous execution
[WebSocket] Capabilities: {'browser': True, 'screenshot': True}
[WebSocket] Sending ACTION: step_001
[WebSocket] RESULT received for step_001
[WebSocket] Success: True
[WebSocket] Sending ACTION: step_002
[WebSocket] RESULT received for step_002
[WebSocket] Success: True
[WebSocket] Sending ACTION: step_003
[WebSocket] RESULT received for step_003
[WebSocket] Success: True
[WebSocket] Sending FINISH
[WebSocket] Conversation complete!
```

### Frontend Console (Expected)
```
[WebSocket] Connecting to: ws://localhost:8000/api/v2/autonomous/ws/execute
[WebSocket] Connected
[useAutonomous] Connected
[useAutonomous] Starting conversation: Test autonomous execution
[WebSocket] Sending INIT: Test autonomous execution
[WebSocket] Received: ACTION
[useAutonomous] Action received: browser.open
[StubExecutor] Executing: browser.open
[StubExecutor] Completed: browser.open ✅
[WebSocket] Sending RESULT: step_001 ✅
[WebSocket] Received: ACTION
[useAutonomous] Action received: browser.fill
[StubExecutor] Executing: browser.fill
[StubExecutor] Completed: browser.fill ✅
[WebSocket] Sending RESULT: step_002 ✅
[WebSocket] Received: ACTION
[useAutonomous] Action received: screenshot
[StubExecutor] Executing: screenshot
[StubExecutor] Completed: screenshot ✅
[WebSocket] Sending RESULT: step_003 ✅
[WebSocket] Received: FINISH
[useAutonomous] Conversation finished: true
```

---

## Troubleshooting

### Backend Won't Start
```bash
# Check if port 8000 is in use
lsof -ti:8000 | xargs kill -9

# Verify .env file
cat .env | grep -E "(OPENAI_API_KEY|HMAC_MASTER_SECRET)"

# Start with verbose output
uvicorn api.main:app --reload --log-level debug
```

### Frontend Won't Connect
```bash
# Check frontend .env
cat .env
# Should have: VITE_API_URL=http://localhost:8000

# Verify backend is accessible
curl http://localhost:8000/health

# Check WebSocket endpoint
wscat -c ws://localhost:8000/api/v2/autonomous/ws/execute
# (Install: npm install -g wscat)
```

### Electron IPC Issues
```bash
# Check electron logs
# Open DevTools in Electron: View → Toggle Developer Tools

# Verify preload script loaded
window.electron.autonomous
# Should exist and have: execute, getStatus methods
```

---

## Next Steps After Manual Test Passes

1. **Automated E2E Test:**
   ```bash
   # Create: tests/e2e/test_websocket_stub.test.js
   # Use Playwright or Puppeteer
   # Test full flow programmatically
   ```

2. **Real AI Planning (Day 5-7):**
   - Replace dummy actions with `AutonomousAgent`
   - Integrate with `core/autonomous_engine.py`
   - Test with real goals

3. **Real Execution (Day 5-7):**
   - Replace `stubExecutor.cjs` with Puppeteer
   - Implement real browser control
   - Test with actual websites

---

## Files Created for Testing

1. **`src/components/AutonomousTest.jsx`** (274 lines)
   - Complete test UI with live status
   - Step-by-step visualization
   - Error handling display

2. **`src/pages/AutonomousTestPage.jsx`**
   - Standalone page wrapper

3. **`src/autonomous-test-main.jsx`**
   - Entry point for test page

4. **`autonomous-test.html`**
   - HTML file to load test page

---

## Expected Timeline

- **Manual Test:** 10-15 minutes
- **Fix any issues:** 15-30 minutes
- **Automated E2E Test:** 30-45 minutes
- **Total:** ~1.5 hours

---

## Success Criteria

✅ **Phase 1 Complete When:**
1. Backend sends 3 actions
2. Frontend receives all 3 actions
3. Frontend executes with stub
4. Frontend sends 3 results
5. Backend receives results
6. Backend sends FINISH
7. No errors in console
8. UI shows completion message

**Current Status:** Code Complete, Ready for Testing! 🚀
