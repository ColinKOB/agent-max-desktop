# Manual E2E Test Checklist

## Prerequisites
```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop
npm run electron:dev
```

## Test 1: Deep Memory Toggle ⏱️ 2 min

**Steps:**
1. Click Settings (gear icon)
2. Look under "Preferences"
3. Find "Deep memory search" toggle

**Pass Criteria:**
- [ ] Toggle is visible
- [ ] Clicking it changes state
- [ ] Console: `localStorage.getItem('pref_deep_memory_search')` returns '1' or '0'

---

## Test 2: History Tab ⏱️ 2 min

**Steps:**
1. Settings → History tab
2. Should show list of conversations

**Pass Criteria:**
- [ ] Shows list of conversations (26+ expected)
- [ ] Each has summary, message count, timestamp
- [ ] No console errors

**If fails:** Run in Console:
```javascript
window.electron.memory.getAllSessions().then(s => console.log(`${s.length} sessions`));
```

---

## Test 3: Memory Badge Creation ⏱️ 3 min

**Steps:**
1. New Chat
2. Type: "I go to Cairn University and I live in Philadelphia"
3. Send and wait for response
4. Look for GREEN BADGE under assistant's message

**Pass Criteria:**
- [ ] Green badge appears
- [ ] Says "Memory created: School — Cairn University • Location — Philadelphia"
- [ ] Console shows: `[Memory] Created badge:`

**If fails:** Check Console for errors

---

## Test 4: Memory Recall ⏱️ 3 min

**Steps:**
1. Start NEW conversation (close/reopen or click New Chat)
2. Ask: "Where do I go to school?"
3. Wait for response

**Pass Criteria:**
- [ ] AI responds with "Cairn University"
- [ ] Console shows: `[Semantic] Searching with threshold=...`
- [ ] Console shows: `[Semantic] Found X similar items`

**Verify memory exists:**
```javascript
window.electron.memory.getFacts().then(f => console.log('Facts:', f));
```

---

## Test 5: Deep Memory Impact ⏱️ 5 min

**Steps:**
1. Settings → Enable "Deep memory search"
2. Ask: "What do you know about me?"
3. Check Console logs
4. Disable deep memory
5. Ask same question
6. Check Console logs

**Pass Criteria:**
- [ ] With deep ON: `threshold=0.65, limit=10, deepMemory=true`
- [ ] With deep OFF: `threshold=0.72, limit=6, deepMemory=false`
- [ ] Different number of results found

---

## Diagnostic Commands

### Quick Health Check
```javascript
// Should all return true/valid data
console.log('API:', !!window.electron?.memory);
window.electron.memory.getFacts().then(f => console.log('Facts:', f));
window.electron.memory.getAllSessions().then(s => console.log('Sessions:', s.length));
```

### Detailed Session Inspection
```javascript
window.electron.memory.getAllSessions().then(sessions => {
  console.log(`Total sessions: ${sessions.length}`);
  if (sessions.length > 0) {
    const first = sessions[0];
    console.log('First session:', {
      id: first.sessionId || first.id,
      messages: first.messages?.length || 0,
      started: first.started_at || first.created_at
    });
    if (first.messages?.[0]) {
      console.log('First message has timestamp?', !!first.messages[0].timestamp);
    }
  }
});
```

### Force Memory Save (Test)
```javascript
window.electron.memory.setFact('test', 'manual_test', 'success')
  .then(() => console.log('✅ Test fact saved'))
  .then(() => window.electron.memory.getFacts())
  .then(f => console.log('Facts now:', f));
```

---

## Expected Timeline

| Test | Duration | Cumulative |
|------|----------|------------|
| Setup | 1 min | 1 min |
| Test 1 | 2 min | 3 min |
| Test 2 | 2 min | 5 min |
| Test 3 | 3 min | 8 min |
| Test 4 | 3 min | 11 min |
| Test 5 | 5 min | **16 min total** |

---

## Results Template

Copy this and fill in:

```
## TEST RESULTS - [DATE] [TIME]

Test 1 (Deep Memory Toggle): [ PASS / FAIL ]
  - Notes: 

Test 2 (History Tab): [ PASS / FAIL ]
  - Sessions found: 
  - Notes:

Test 3 (Memory Badge): [ PASS / FAIL ]
  - Badge appeared: 
  - Console logs seen:
  - Notes:

Test 4 (Memory Recall): [ PASS / FAIL ]
  - AI response:
  - Semantic search logs:
  - Notes:

Test 5 (Deep Memory Impact): [ PASS / FAIL ]
  - Threshold changes verified:
  - Notes:

OVERALL: [ ALL PASS / X FAILURES ]

Issues encountered:
1. 
2. 

Console errors:
```

---

## If All Tests Pass

✅ **Features are working E2E!**

Close this issue and mark complete:
- Memory badge rendering
- Semantic search with logging
- History timestamp handling  
- Deep memory toggle

---

## If Any Test Fails

1. **Copy console logs** (including errors)
2. **Copy the Results Template** with details
3. **Provide screenshots** if helpful
4. Report back with all three

I'll debug based on the logs and implement fixes.
