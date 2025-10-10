# ✅ Test Checklist - Connection Debugging

## Before You Start

### 1. Backend Must Be Running
```bash
# Terminal 1
cd Agent_Max
python -m api.main

# Should see:
# INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 2. Verify Backend is Accessible
```bash
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","version":"2.0.0",...}
```

---

## Start the App

```bash
# Terminal 2
cd agent-max-desktop
./start_app.sh
```

---

## Check Console Logs (CRITICAL!)

**Open DevTools IMMEDIATELY**: `Cmd+Option+I`

### Expected Logs (In Order):

```
✅ [Config] Development mode detected - using localhost:8000
✅ [API] Step 1: Module loading...
✅ [API] Step 2: Config imported, API_URL: http://localhost:8000
✅ [API] Step 3: Final configuration:
✅ [API]   - Base URL: http://localhost:8000
✅ [API]   - Environment: development
✅ [API]   - Is Development: true
✅ [API] ✅ Base URL is set correctly
✅ [Health] Checking API connection to: http://localhost:8000/health
✅ [Health] Fetch test successful: {status: "healthy", ...}
✅ [Health] Axios request successful: {status: "healthy", ...}
```

### If You See Errors:

#### Error 1: Config Not Loading
```
❌ [API] Step 2: Config imported, API_URL: undefined
```
**Fix:** Config file has syntax error

#### Error 2: Wrong URL
```
❌ [API]   - Base URL: https://api.agentmax.com
```
**Fix:** Not detecting development mode

#### Error 3: Network Error
```
❌ [Health] Fetch test failed: TypeError: Failed to fetch
```
**Fix:** Electron security or backend not running

#### Error 4: Axios Error
```
❌ API Error Details: { code: "ERR_NETWORK" }
```
**Fix:** Axios configuration issue

---

## Check Network Tab

1. Open DevTools → Network tab
2. Look for `/health` request
3. Should be:
   - Status: `200 OK`
   - Response: `{"status":"healthy",...}`
   - Type: `xhr` or `fetch`

---

## Try Sending a Message

1. Type: "Hello"
2. Press Enter
3. Should see:
   - Progress bar
   - "🤔 Processing your request..."
   - AI response

---

## If Still Failing - Copy These Logs

### From Console:
- All lines starting with `[Config]`
- All lines starting with `[API]`
- All lines starting with `[Health]`
- Any red error messages

### From Network Tab:
- Screenshot of `/health` request
- Status code
- Response body

### From Backend Terminal:
- Any errors from `python -m api.main`

---

## Quick Fixes

### Fix 1: Restart Everything
```bash
# Kill both terminals
# Restart backend
cd Agent_Max && python -m api.main

# Restart frontend
cd agent-max-desktop && ./start_app.sh
```

### Fix 2: Clear Cache
```bash
# Kill app
# Clear Vite cache
rm -rf node_modules/.vite

# Restart
./start_app.sh
```

### Fix 3: Check Electron Security
Open `electron/main.cjs` line 38:
```javascript
webSecurity: false,  // ← Must be false
```

---

## Success Criteria

✅ Backend running on port 8000
✅ Console shows: `[API] ✅ Base URL is set correctly`
✅ Console shows: `[Health] Fetch test successful`
✅ Console shows: `[Health] Axios request successful`
✅ Network tab shows `/health` request with 200 OK
✅ Can send message and get AI response

---

**Send me the console output if any of these fail!**
