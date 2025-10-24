# Memory Features Testing Instructions

## ⚠️ Critical Issue Found

The `test_memory_features.html` file **cannot** be opened in a regular web browser (Chrome, Safari, Firefox) because the `window.electron` API only exists inside the Electron app.

## Problem

When you open the HTML file in a browser, you get:
```
window.electron is undefined
```

This is because `window.electron` is injected by Electron's `contextBridge` in the preload script - it's not a standard web API.

---

## ✅ Solution 1: Test in DevTools Console (FASTEST)

This is the quickest way to test the memory features:

### Step 1: Run the Electron app
```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop
npm run electron:dev
```

### Step 2: Open DevTools
- Press **Cmd+Option+I** (Mac) or **Ctrl+Shift+I** (Windows/Linux)

### Step 3: Run these tests in the Console

```javascript
// ============================================
// Quick Diagnostic
// ============================================

// Test 1: Check if API is available
console.log('Electron API:', !!window.electron?.memory);

// Test 2: Get facts
window.electron.memory.getFacts()
  .then(f => console.log('✅ Facts:', f))
  .catch(e => console.error('❌ Facts error:', e));

// Test 3: Get all sessions
window.electron.memory.getAllSessions()
  .then(s => {
    console.log(`✅ Found ${s.length} sessions`);
    if (s.length > 0) console.log('First session:', s[0]);
  })
  .catch(e => console.error('❌ Sessions error:', e));

// Test 4: Get recent messages
window.electron.memory.getRecentMessages(5)
  .then(m => {
    console.log(`✅ Found ${m.length} recent messages`);
    m.forEach((msg, i) => console.log(`  ${i+1}. [${msg.role}] ${msg.content.slice(0, 50)}...`));
  })
  .catch(e => console.error('❌ Messages error:', e));

// Test 5: Check preferences
console.log('Deep memory:', localStorage.getItem('pref_deep_memory_search') === '1');

// Test 6: Add a test fact
window.electron.memory.setFact('test', 'timestamp', Date.now().toString())
  .then(() => console.log('✅ Test fact saved'))
  .catch(e => console.error('❌ Error saving fact:', e));
```

---

## ✅ Solution 2: Open Test Window in Electron

I've created a test window that opens the HTML file inside Electron:

### Step 1: Run the app
```bash
npm run electron:dev
```

### Step 2: Open the test window

In the DevTools Console, run:
```javascript
window.electron.openTestWindow();
```

Or add this button temporarily to the UI.

This will open `test_memory_features.html` in an Electron window where `window.electron` will be available.

---

## ✅ Solution 3: Manual E2E Testing

Follow the checklist in **MANUAL_TEST_CHECKLIST.md**:

1. **Deep Memory Toggle** (2 min)
   - Settings → Preferences
   - Verify "Deep memory search" toggle exists

2. **History Tab** (2 min)
   - Settings → History
   - Should show 26+ conversation sessions

3. **Memory Badge** (3 min)
   - New chat
   - Say: "I go to Cairn University"
   - Look for green badge under response

4. **Memory Recall** (3 min)
   - New chat
   - Ask: "Where do I go to school?"
   - Should answer "Cairn University"

5. **Deep Memory Effect** (5 min)
   - Toggle deep memory on/off
   - Check Console logs for threshold changes

---

## Debug Commands Reference

### Quick Health Check
```javascript
// All should work if memory system is initialized
window.electron.memory.getFacts().then(console.log);
window.electron.memory.getAllSessions().then(s => console.log(`${s.length} sessions`));
window.electron.memory.getProfile().then(console.log);
```

### Inspect Session Structure
```javascript
window.electron.memory.getAllSessions().then(sessions => {
  if (sessions.length > 0) {
    const first = sessions[0];
    console.log('Session structure:', {
      id: first.sessionId || first.id,
      messages: first.messages?.length || 0,
      firstMessage: first.messages?.[0],
      hasTimestamp: !!first.messages?.[0]?.timestamp
    });
  }
});
```

### Force Save Test Data
```javascript
// Save a fact
window.electron.memory.setFact('education', 'school', 'Cairn University')
  .then(() => console.log('✅ Fact saved'))
  .then(() => window.electron.memory.getFacts())
  .then(f => console.log('Facts now:', f));

// Add a message
window.electron.memory.addMessage('user', 'Test message from console')
  .then(() => console.log('✅ Message saved'));
```

### Check localStorage Preferences
```javascript
console.log({
  theme: localStorage.getItem('pref_theme'),
  analytics: localStorage.getItem('pref_analytics') === '1',
  deepMemory: localStorage.getItem('pref_deep_memory_search') === '1'
});
```

---

## Expected Results

If everything is working:

```
✅ window.electron.memory exists
✅ getFacts() returns object with categories
✅ getAllSessions() returns array with 26+ sessions
✅ getRecentMessages() returns array of message objects
✅ localStorage has pref_deep_memory_search key
✅ setFact() saves successfully
```

If you see errors:

```javascript
// Check initialization
console.log('Memory manager initialized?', !!window.electron?.memory);

// Try calling functions and note exact error messages
window.electron.memory.getFacts()
  .then(r => console.log('Success:', r))
  .catch(e => console.error('Error details:', e.message, e.stack));
```

---

## Why This Happens

**The HTML file opened in a web browser vs Electron:**

| Environment | `window.electron` | Memory API |
|-------------|-------------------|------------|
| Chrome/Safari/Firefox | ❌ undefined | ❌ Not available |
| Electron Renderer | ✅ Injected by preload | ✅ Available |

The Electron app uses a preload script (`electron/preload.cjs`) that exposes the memory API via `contextBridge.exposeInMainWorld()`. This only works in Electron's renderer process, not in regular browsers.

---

## Next Steps

1. ✅ Run `npm run electron:dev`
2. ✅ Open DevTools (Cmd+Option+I)
3. ✅ Copy/paste the Quick Diagnostic tests above
4. ✅ Report results (all commands should work)
5. ✅ If API not available, check Console for initialization errors

**The memory system IS implemented. It just needs to be tested in the correct environment (Electron app, not web browser).**
