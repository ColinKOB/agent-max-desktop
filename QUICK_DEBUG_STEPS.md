# 🔍 Quick Debug Steps

## Backend Confirmed Working! ✅
```bash
curl http://localhost:8000/health
# Returns: {"status":"healthy",...}
```

---

## Now Test Frontend:

### 1. **Restart App with DevTools**
```bash
./start_app.sh
```

### 2. **Open DevTools Immediately**
- Press: `Cmd+Option+I` (Mac)
- Or: View → Toggle Developer Tools

### 3. **Look for These New Detailed Logs:**

**Expected Success:**
```
[API] Base URL: http://localhost:8000
[Health] Checking API connection to: http://localhost:8000/health
[Health] Fetch test successful: {status: "healthy", ...}
[Health] Axios request successful: {status: "healthy", ...}
```

**Expected Failure (with details):**
```
[API] Base URL: http://localhost:8000
[Health] Checking API connection to: http://localhost:8000/health
[Health] Fetch test failed: TypeError: Failed to fetch
[Health] API health check failed
[Health] Error type: AxiosError
[Health] Error code: ERR_NETWORK
[Health] Error config: {url: "/health", baseURL: "http://localhost:8000", ...}
```

---

## What Each Test Tells Us:

### **Fetch Test:**
- Tests if Electron can reach localhost at all
- If this fails: Electron security issue

### **Axios Test:**
- Tests if our API client works
- If this fails but fetch works: Axios configuration issue

---

## Common Issues:

### **Issue: Both Tests Fail**
```
[Health] Fetch test failed: TypeError: Failed to fetch
[Health] API health check failed
```
**Cause:** Electron security blocking localhost

**Fix:** Add to `electron/main.cjs`:
```javascript
webPreferences: {
  webSecurity: false, // Allow localhost requests
  // ... other settings
}
```

### **Issue: Fetch Works, Axios Fails**
```
[Health] Fetch test successful: {...}
[Health] Error code: ECONNREFUSED
```
**Cause:** Axios configuration issue

**Fix:** Check axios baseURL is correct

---

## Quick Test Commands:

```bash
# 1. Is backend running?
curl http://localhost:8000/health

# 2. What's listening on port 8000?
lsof -i :8000

# 3. Can reach from browser?
open http://localhost:8000/health
```

---

## 📸 Send Me:

**Copy and paste from DevTools console:**
- All lines starting with `[API]`
- All lines starting with `[Health]`
- Any error messages

This will tell us exactly what's failing!
