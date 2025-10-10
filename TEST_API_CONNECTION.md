# 🧪 Test API Connection

## Quick Test: Is Your Backend Accessible?

### **Test 1: Backend Health**
```bash
# From terminal
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","version":"2.0.0",...}
```

### **Test 2: Start Backend**
```bash
cd Agent_Max
python -m api.main

# Should see:
# INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### **Test 3: Start Frontend**
```bash
cd agent-max-desktop
./start_app.sh

# Open DevTools (Cmd+Option+I)
# Look for:
# [API] Initializing with Base URL: http://localhost:8000
# [API] Environment: development
# [Health] Fetch test successful: {status: "healthy"}
```

---

## ✅ If Everything Works:

You should see in console:
```
[API] Initializing with Base URL: http://localhost:8000
[API] Environment: development
[API] Is Development: true
[Health] Checking API connection to: http://localhost:8000/health
[Health] Fetch test successful: {status: "healthy", ...}
[Health] Axios request successful: {status: "healthy", ...}
```

---

## ❌ If Still Failing:

### Check 1: Is Backend Running?
```bash
lsof -i :8000
# Should show python process
```

### Check 2: Can you reach it manually?
```bash
curl http://localhost:8000/health
# Should return JSON
```

### Check 3: Check Console Logs

Look for specific error:
- `ERR_NETWORK` → Backend not reachable
- `ERR_CONNECTION_REFUSED` → Backend not running
- `CORS error` → CORS not configured

---

## 🔧 Common Fixes:

### Fix 1: Backend Not Running
```bash
cd Agent_Max
python -m api.main
```

### Fix 2: Wrong Port
```bash
# Check what port backend is on
lsof -i :8000

# If different, update .env:
echo "VITE_API_URL=http://localhost:XXXX" > .env
```

### Fix 3: Firewall Blocking
```bash
# Disable firewall temporarily to test
# macOS: System Preferences → Security → Firewall
```

---

## 📸 Send Me These:

1. **Backend logs** (from `python -m api.main`)
2. **Console logs** (from DevTools - everything starting with `[API]` or `[Health]`)
3. **Network tab** (in DevTools → Network → filter by `health`)

This will tell us exactly what's wrong!
