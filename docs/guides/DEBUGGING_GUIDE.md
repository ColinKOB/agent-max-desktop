# 🐛 Debugging Guide - Agent Max Desktop

## ✅ **Fix Applied: Memory Manager Initialization**

### **Issue:** 
`TypeError: Cannot read properties of undefined (reading 'getProfile')`

### **Root Cause:**
The memory manager was being accessed before it was fully initialized.

### **Fix:**
1. Added `ensureMemoryManager()` helper function in `electron/main.cjs`
2. All IPC handlers now check if memory manager is ready
3. App.jsx now uses local memory instead of API for profile

---

## 🔍 **How to Debug Electron App**

### **1. Open DevTools**

In `electron/main.cjs` line 58, uncomment:
```javascript
mainWindow.webContents.openDevTools({ mode: 'detach' });
```

Then restart the app. DevTools will open automatically.

### **2. Check Console Logs**

**Electron Main Process (Terminal):**
- Shows: "✓ Memory manager initialized"
- Shows: Storage location
- Shows: IPC handler errors

**Renderer Process (DevTools Console):**
- Shows: React errors
- Shows: API call errors
- Shows: Memory service errors

### **3. Common Errors & Fixes**

#### **Error: "Memory manager not initialized"**
**Cause:** App tried to use memory before Electron was ready  
**Fix:** Already fixed with `ensureMemoryManager()` helper  
**Check:** Look for "✓ Memory manager initialized" in terminal

#### **Error: "Failed to load profile"**
**Cause:** Memory files don't exist yet (first run)  
**Fix:** Normal on first run - defaults will be used  
**Check:** Files created at `~/Library/Application Support/agent-max-desktop/memories/`

#### **Error: "API health check failed"**
**Cause:** Backend API not running  
**Fix:** Start API in separate terminal: `./start_api.sh`  
**Check:** Visit http://localhost:8000/health

#### **Error: "Failed to send message"**
**Cause:** API not running or network error  
**Fix:** Check API is running, check browser Network tab  
**Check:** Look for 200 response in Network tab

---

## 🧪 **Testing Checklist**

### **Before Testing:**
- [ ] API running (Terminal 1)
- [ ] Electron app running (Terminal 2)
- [ ] DevTools open (optional but helpful)
- [ ] Check terminal for "✓ Memory manager initialized"

### **Test 1: App Opens**
- [ ] Window appears
- [ ] No errors in console
- [ ] Greeting shows "Hi, User!" or your name

### **Test 2: Memory System**
```javascript
// In DevTools console:
await window.electron.memory.getProfile()
// Should return: { name: "...", interaction_count: 0, ... }

await window.electron.memory.setName("Colin")
// Should return: "Colin"

await window.electron.memory.getProfile()
// Should return: { name: "Colin", ... }
```

### **Test 3: Send Message**
- [ ] Type message in input
- [ ] Press Enter
- [ ] See "🤔 Processing..." 
- [ ] See AI response (5-10s)
- [ ] No errors in console

### **Test 4: Memory Persistence**
- [ ] Set your name: "My name is Colin"
- [ ] Close app completely
- [ ] Reopen app
- [ ] Check greeting shows "Hi, Colin!"

---

## 📊 **Debug Commands**

### **Check Memory Files:**
```bash
ls -la ~/Library/Application\ Support/agent-max-desktop/memories/
```

### **View Memory File (Encrypted):**
```bash
cat ~/Library/Application\ Support/agent-max-desktop/memories/profile.json
# Should see: {"iv":"...","data":"..."}
```

### **Check API Status:**
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy",...}
```

### **Test Autonomous Endpoint:**
```bash
curl -X POST http://localhost:8000/api/v2/autonomous/quick \
  -H "Content-Type: application/json" \
  -d '{"goal": "What is 2+2?"}'
```

---

## 🔧 **If App Won't Start**

### **1. Check Dependencies:**
```bash
cd agent-max-desktop
npm install
```

### **2. Check node-machine-id:**
```bash
ls node_modules/node-machine-id
# If missing: npm install node-machine-id
```

### **3. Check Vite:**
```bash
npm run dev
# Should start on http://localhost:5173
```

### **4. Clear Cache:**
```bash
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

---

## 🎯 **Expected Behavior**

### **On First Run:**
1. App opens
2. Terminal shows: "✓ Memory manager initialized"
3. Memory directory created
4. Empty memory files created
5. Greeting: "Hi there!" (no name yet)

### **After Setting Name:**
1. Type: "My name is Colin"
2. AI responds
3. Memory file updated
4. Next time: Greeting shows "Hi, Colin!"

### **After Sending Messages:**
1. Messages stored in conversations.json
2. Facts extracted (if any)
3. Context sent with each request
4. AI uses your context in responses

---

## 🚨 **Known Issues**

### **1. Memory Manager Timing (FIXED)**
- **Issue:** Memory accessed before initialization
- **Status:** ✅ Fixed with `ensureMemoryManager()`

### **2. API Not Running**
- **Issue:** App tries to send messages but API is down
- **Fix:** Always start API first
- **Check:** http://localhost:8000/health

### **3. Facts Not Extracted**
- **Issue:** Basic regex doesn't catch most facts
- **Status:** Known limitation
- **Workaround:** Manually set facts via memory API

---

## 📝 **Logging**

### **Enable Verbose Logging:**

In `electron/main.cjs`, add at top:
```javascript
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}
```

Then add logging:
```javascript
ipcMain.handle('memory:get-profile', () => {
  log('Getting profile...');
  const profile = ensureMemoryManager().getProfile();
  log('Profile:', profile);
  return profile;
});
```

---

## 🎉 **Success Indicators**

**Terminal (Main Process):**
```
✓ Memory manager initialized
  Storage location: ~/Library/Application Support/agent-max-desktop/memories
```

**DevTools Console:**
```
No errors
API connected: true
```

**App Behavior:**
- Opens without errors
- Shows greeting
- Accepts input
- Sends messages
- Displays responses
- Remembers your name

---

## 🆘 **Still Having Issues?**

1. **Check all terminals for errors**
2. **Open DevTools and check Console tab**
3. **Check Network tab for failed requests**
4. **Verify memory files exist**
5. **Restart both API and Electron app**
6. **Clear memory files and try again:**
   ```bash
   rm -rf ~/Library/Application\ Support/agent-max-desktop/memories/
   ```

---

**The fix is applied! Restart the Electron app and it should work now.** 🚀
