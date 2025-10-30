# Backend & Frontend Connection Issues - DIAGNOSIS

**Date**: October 20, 2025, 12:41 PM EDT

---

## 🔴 ISSUE SUMMARY

**Symptom**: Frontend cannot connect to backend
**Error**: `NETWORK_ERROR: No response from server`
**Root Cause**: Axios instance has `baseURL: undefined`

---

## ✅ BACKEND STATUS

**Port 8000**: ✅ RUNNING (PID 94159)
**Health Check**: ✅ WORKING
```bash
$ curl http://127.0.0.1:8000/health
{"status":"healthy","version":"2.0.0","service":"Agent Max Memory System V2"}
```

**Conclusion**: Backend is fine!

---

## 🔴 FRONTEND ISSUE

### Error from Console:
```
[Health] Error config: {url: undefined, baseURL: undefined, method: undefined}
```

### Analysis:

**File**: `agent-max-desktop/src/services/api.js`

**Line 51-57**: Axios instance creation
```javascript
const api = axios.create({
  baseURL: API_BASE_URL,  // ← This is undefined!
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});
```

**Line 20-28**: API_BASE_URL initialization
```javascript
const initialConfig = apiConfigManager.getConfig();
logger.info('Initial configuration', {
  baseURL: initialConfig.baseURL,  // ← Check browser console for this log
  hasApiKey: !!initialConfig.apiKey,
  environment: import.meta.env.MODE,
});

let API_BASE_URL = initialConfig.baseURL;  // ← undefined if config fails
```

### Why is baseURL undefined?

**Possible causes**:
1. `apiConfigManager.getConfig()` is returning undefined or `{}`
2. The apiConfigManager singleton isn't initializing before api.js loads
3. localStorage is empty AND environment variables aren't set

---

## 🔍 NEXT STEPS TO DEBUG

### 1. Check Browser Console
Look for this log message on page load:
```
[ApiConfig] Initial configuration { baseURL: '...', hasApiKey: ..., environment: '...' }
```

If you see:
- `baseURL: undefined` → apiConfigManager.loadConfig() failed
- No log at all → api.js didn't execute or logger failed

### 2. Check apiConfigManager Logic

**File**: `agent-max-desktop/src/config/apiConfig.js` (Line 14-45)

```javascript
loadConfig() {
  // Priority 1: localStorage
  const savedUrl = localStorage.getItem('api_url');
  if (savedUrl) return { baseURL: savedUrl };

  // Priority 2: Environment variable  
  if (import.meta.env.VITE_API_URL) {
    return { baseURL: import.meta.env.VITE_API_URL };
  }

  // Priority 3: Development default
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    return { baseURL: 'http://localhost:8000' };  // ← Should return this!
  }

  // Priority 4: Production default
  return { baseURL: 'https://api.agentmax.com' };
}
```

**Expected**: In development mode, should return `{ baseURL: 'http://localhost:8000' }`

---

## 🛠️ FIXES TO TRY

### Fix #1: Force baseURL in api.js (Quick Fix)

Add a fallback in `agent-max-desktop/src/services/api.js` line 28:

```javascript
let API_BASE_URL = initialConfig.baseURL || 'http://localhost:8000';
```

### Fix #2: Add Defensive Check in apiConfig.js

Add a fallback at the end of loadConfig():

```javascript
loadConfig() {
  // ... existing logic ...

  // Fallback: Ensure we always return something
  const config = this.determineConfig(); // existing logic
  if (!config || !config.baseURL) {
    console.warn('[ApiConfig] Config invalid, using localhost fallback');
    return { baseURL: 'http://localhost:8000' };
  }
  return config;
}
```

### Fix #3: Log apiConfigManager State

Add console.log in `apiConfig.js` constructor:

```javascript
constructor() {
  this.listeners = new Set();
  this.config = this.loadConfig();
  console.log('[ApiConfig] Initialized with config:', this.config);  // ← Add this
}
```

---

## 🎯 RECOMMENDED ACTION

**Immediate Fix** (fastest):
```javascript
// agent-max-desktop/src/services/api.js line 28
let API_BASE_URL = initialConfig.baseURL || 'http://localhost:8000';
```

**Debugging** (to understand root cause):
1. Open browser DevTools → Console
2. Look for `[ApiConfig]` log messages
3. Check what `import.meta.env.DEV` and `import.meta.env.MODE` are

**Long-term Fix**:
- Add validation to ensure baseURL is never undefined
- Add error boundary to catch initialization failures
- Add retry logic for failed config loads

---

## 📊 CURRENT STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| Backend (port 8000) | ✅ RUNNING | Health check passes |
| Frontend (port 5173) | ❌ BROKEN | axios baseURL undefined |
| apiConfigManager | ❓ UNKNOWN | Need to check console logs |
| Axios instance | ❌ INVALID | Created with undefined baseURL |

---

## 💡 WHY THIS HAPPENED

**Timeline**:
1. Backend was hanging (previous issue) → killed and restarted ✅
2. Frontend tried to connect → failed because axios had no baseURL
3. Axios retries made error worse (exponential backoff)
4. Error object lost config info during retry failures

**Root Issue**: apiConfigManager.getConfig() is returning undefined baseURL in development mode, which suggests:
- `import.meta.env.DEV` is false
- `import.meta.env.MODE` is not 'development'
- localStorage is empty
- No VITE_API_URL environment variable

---

**Next Action**: Add the one-line fallback fix and reload the frontend to test!
