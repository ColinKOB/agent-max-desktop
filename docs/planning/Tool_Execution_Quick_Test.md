# 🧪 Autonomous Tool Execution - Quick Test Guide

**Status**: ✅ Integrated and tested  
**Date**: 2025-11-05


---


## What to Test in Desktop App

### Test 1: Basic File Creation ⭐
**Prompt**: "Create a file called test.txt with Hello World"

**Expected**:
- 🔧 Toast: "Executing 2 action(s)..."
- ✅ Toast: "File created"
- Response: "I've created the file ~/test.txt with 'Hello World'."

---

### Test 2: Read and Analyze
**Prompt**: "Read my package.json and list the main dependencies"

**Expected**:
- ✅ Toast: "File read"
- Response with dependency list

---

### Test 3: Append to File
**Prompt**: "Create notes.txt with Line1, then append Line2 to it"

**Expected**:
- ✅ Toast: "File created"
- ✅ Toast: "File updated"

---

### Test 4: List Directory
**Prompt**: "List all files in my Desktop directory"

**Expected**:
- ✅ Toast: "Directory listed"
- Response with file list

---

### Test 5: Error Handling
**Prompt**: "Read nonexistent_file.txt"

**Expected**:
- ❌ Toast: "Error: File not found" (or similar)
- Response acknowledging the error

---

### Test 6: Shell Command Safety
**Prompt**: "Run ls -la command"

**Expected**:
- 🔒 Toast: "Action requires approval: sh.run"
- Command NOT executed automatically

---


## What You Should See

### Toast Notifications
- **Blue glassmorphism** → Info/Action count
- **Green glassmorphism** → Success
- **Red glassmorphism** → Error
- **Yellow glassmorphism** → Needs approval

### Thinking Status
- Shows current action: "File created", "Executing 2 action(s)...", etc.

### Thought History
- All actions logged with emojis:
  - ✅ Executed fs.write: ok
  - ❌ Error messages
  - 🔒 Queued actions

---


## Quick cURL Test (Backend Verification)

```bash
curl -N -X POST "https://agentmax-production.up.railway.app/api/v2/agent/execute/stream" \
  -H "x-api-key: e341a4acb41aa9c80b4baba442b0a24e8d1ce9fa7b4e5307ed34ef2aa15258f0" \
  -H "Content-Type: application/json" \
  -H "X-Events-Version: 1.1" \
  -d '{
    "message": "Create a file called test.txt with Hello World",
    "mode": "autonomous",
    "flags": {"server_fs": true}
  }'
```

**Look for**:
- `exec_log` events with status "completed"
- "Executed fs.write: ok"

---


## Troubleshooting

### No notifications appearing?
1. Check autonomous mode is enabled (not chatty/helpful)
2. Verify backend is using production endpoint
3. Check browser console for toast errors

### AI says "I can't access files"?
1. Ensure `flags.server_fs: true` is in request
2. Check API key is valid
3. Try more explicit prompt: "Create a file using fs.write"

### Shell commands executing?
**This should NEVER happen** - contact backend team if `sh.run` shows "completed"

---


## Files Changed

1. `src/services/api.js` - Added `flags.server_fs: true`
2. `src/components/FloatBar/AppleFloatBar.jsx` - Enhanced exec_log handler

**Total**: ~100 lines of code
