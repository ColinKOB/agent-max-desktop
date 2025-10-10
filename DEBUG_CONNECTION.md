# 🔍 Connection Debugging Guide

## Issue: "Cannot reach the server" Error

---

## ✅ **Quick Checks**

### 1. **Backend is Running**
```bash
# Test backend directly
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","version":"2.0.0","service":"Agent Max Memory System V2"}
```

✅ **Backend is confirmed running!**

---

### 2. **Check Console Logs**

Open DevTools (Cmd+Option+I) and look for these logs:

```
[API] Base URL: http://localhost:8000
[Health] Checking API connection...
[Health] API is healthy: {status: "healthy", ...}
```

**OR if failing:**

```
[API] Base URL: http://localhost:8000
[Health] Checking API connection...
API Error Details: {
  url: "/health",
  method: "get",
  code: "ERR_NETWORK" or "ECONNREFUSED",
  message: ...
}
[Health] API health check failed: ...
```

---

## 🐛 **Common Issues & Fixes**

### **Issue 1: CORS Error**

**Symptoms:**
```
Access to XMLHttpRequest at 'http://localhost:8000/health' from origin 
'http://localhost:5173' has been blocked by CORS policy
```

**Fix:** Check backend CORS settings in `api/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### **Issue 2: Wrong Port**

**Symptoms:**
```
API Error Details: { code: "ECONNREFUSED" }
```

**Check:**
1. Frontend expects: `http://localhost:8000`
2. Backend running on: `python -m api.main` (should show port 8000)

**Fix if different port:**
```bash
# Set environment variable
export VITE_API_URL=http://localhost:XXXX
npm run electron:dev
```

---

### **Issue 3: Request Timeout**

**Symptoms:**
```
API Error Details: { code: "ECONNABORTED", message: "timeout of 60000ms exceeded" }
```

**Cause:** Backend is too slow or stuck

**Fix:**
1. Check backend logs for errors
2. Restart backend: `python -m api.main`

---

### **Issue 4: Metadata Undefined**

**Symptoms:**
```
TypeError: Cannot read properties of undefined (reading 'retryCount')
```

**Fix:** Already handled in latest code - retry metadata is added automatically

---

## 🔧 **Testing Endpoints**

### Test Health Check:
```bash
curl http://localhost:8000/health
```

### Test Chat Endpoint:
```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "include_context": true}'
```

---

## 📊 **Current Configuration**

```javascript
// Frontend (src/services/api.js)
API_BASE_URL: http://localhost:8000
Timeout: 60 seconds (60000ms)
Retry: 3 attempts with exponential backoff

// Endpoints
Health: GET /health
Chat: POST /api/chat/message
```

---

## 🚀 **Next Steps**

1. **Restart both services:**
   ```bash
   # Terminal 1 - Backend
   cd Agent_Max
   python -m api.main
   
   # Terminal 2 - Frontend  
   cd agent-max-desktop
   ./start_app.sh
   ```

2. **Open DevTools (Cmd+Option+I)**

3. **Look for these logs:**
   - `[API] Base URL: http://localhost:8000`
   - `[Health] Checking API connection...`
   - `[Health] API is healthy: ...`

4. **Try sending a message**

5. **Check console for any errors**

---

## 💡 **Expected Console Output (Success)**

```
[API] Base URL: http://localhost:8000
[Health] Checking API connection...
[Health] API is healthy: {status: "healthy", version: "2.0.0", ...}

// When sending message:
[FloatBar] Sending message: Hello
[Connection] Success - marking as connected
Response received in 1234ms

// If screenshot:
[FloatBar] Screenshot attached (XXkB)
[FloatBar] Screenshot sent and cleared
```

---

## ❌ **Expected Console Output (Error)**

```
[API] Base URL: http://localhost:8000
[Health] Checking API connection...
API Error Details: {
  url: "/health",
  method: "get", 
  baseURL: "http://localhost:8000",
  code: "ERR_NETWORK",
  message: "Network Error"
}
[Health] API health check failed: Network Error
[Connection] Marking as disconnected - no response from server
```

**This tells you:**
- URL is correct: `http://localhost:8000/health`
- Error type: `ERR_NETWORK` or `ECONNREFUSED`
- No response from server

**Next step:** Check if backend is actually running on port 8000

---

## 🎯 **Quick Test Commands**

```bash
# 1. Check if backend is running
curl http://localhost:8000/health

# 2. Check if frontend can reach it
# Open browser DevTools → Network tab → Look for /health request

# 3. Test chat endpoint
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "include_context": true}'

# 4. Check what's listening on port 8000
lsof -i :8000

# 5. Check backend logs
# Should see: INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## ✅ **Solution Checklist**

- [ ] Backend is running (`curl http://localhost:8000/health` works)
- [ ] Frontend is running (`npm run electron:dev`)
- [ ] No CORS errors in console
- [ ] API Base URL is correct (`http://localhost:8000`)
- [ ] No firewall blocking localhost:8000
- [ ] DevTools Network tab shows successful /health requests

---

**Once all checks pass, try sending a message again!**
