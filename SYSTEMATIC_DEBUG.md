# 🔍 Systematic Debugging - Connection Issues

## Test Plan

We'll test each potential issue systematically:

1. ✅ Backend Running
2. ✅ Config File Loading
3. ✅ API Service Initialization
4. ✅ CORS Headers
5. ✅ Electron Security
6. ✅ Network Request Path
7. ✅ Error Handling

---

## Test 1: Backend Running ✓

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"healthy",...}`

---

## Test 2: Backend Process

```bash
lsof -i :8000
```

Expected: Python process on port 8000

---

## Test 3: Config File Import

Check if `src/config/api.js` has any syntax errors

---

## Test 4: Frontend Console Logs

Expected logs:
- `[API] Initializing with Base URL: http://localhost:8000`
- `[API] Environment: development`
- `[Health] Checking API connection to: ...`

---

## Test 5: Network Tab

DevTools → Network → Look for `/health` request
- Status should be 200
- Response should have JSON

---

## Fixes to Try (In Order)

1. Verify backend is running
2. Check config file syntax
3. Verify imports work
4. Check browser console for errors
5. Check Network tab for failed requests
6. Verify CORS on backend
7. Try direct fetch in console
