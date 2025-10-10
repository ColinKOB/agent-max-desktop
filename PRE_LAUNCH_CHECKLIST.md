# 🚀 Pre-Launch Testing Checklist - Agent Max Desktop

**Critical:** Test EVERYTHING before publishing. This is a comprehensive list covering backend, frontend, and all systems.

---

## 📋 **Testing Categories**

1. [Backend API](#backend-api)
2. [Frontend UI](#frontend-ui)
3. [Electron App](#electron-app)
4. [Memory System](#memory-system)
5. [Screenshot Feature](#screenshot-feature)
6. [Semantic Embeddings](#semantic-embeddings)
7. [Chat & Messaging](#chat--messaging)
8. [Error Handling](#error-handling)
9. [Performance](#performance)
10. [Security](#security)
11. [User Experience](#user-experience)
12. [Cross-Platform](#cross-platform)
13. [Edge Cases](#edge-cases)
14. [Integration](#integration)
15. [Documentation](#documentation)

---

## 🔴 **CRITICAL ISSUES (Fix First)**

### **Mini Square Not Clickable**
- [ ] Window starts at 68x68 (not 360px)
- [ ] No extra gray space
- [ ] Click "MAX" opens full chat
- [ ] Cursor pointer shows on hover
- [ ] No `-webkit-app-region: drag` blocking clicks

### **Window Sizing**
- [ ] Electron minWidth: 68 (not 360)
- [ ] Electron maxWidth: 520 (not 360)
- [ ] Electron resizable: true (not false)
- [ ] CSS `.amx-root` doesn't force width
- [ ] All three states work (mini/pill/card)

---

## 1️⃣ **Backend API** (Agent_Max)

### **API Server**
- [ ] Server starts without errors: `./start_api.sh`
- [ ] Health check works: `curl http://localhost:8000/health`
- [ ] API docs accessible: http://localhost:8000/docs
- [ ] CORS configured correctly
- [ ] Rate limiting works
- [ ] API keys validated

### **Endpoints**
- [ ] POST `/api/v2/autonomous/execute` - Main chat endpoint
- [ ] POST `/api/v2/autonomous/quick` - Quick responses
- [ ] POST `/api/v2/semantic/similar` - Find similar goals
- [ ] POST `/api/v2/semantic/embedding` - Get embeddings
- [ ] GET `/api/v2/semantic/patterns` - Get patterns
- [ ] GET `/health` - Health check

### **LLM Integration**
- [ ] GPT-5-nano for decision making (execute vs respond)
- [ ] GPT-4o-mini for conversational responses
- [ ] GPT-4o for screenshot analysis (vision)
- [ ] Reasoning effort: low for speed
- [ ] Max tokens appropriate (500 for questions, 2000 for vision)
- [ ] Error handling for API failures

### **Response Times**
- [ ] Simple question: < 5s
- [ ] Screenshot analysis: < 10s
- [ ] Command execution: < 15s
- [ ] Semantic search: < 2s

### **Error Handling**
- [ ] Invalid API key returns 401
- [ ] Missing parameters return 422
- [ ] Server errors return 500 with message
- [ ] Timeout after 300s
- [ ] Rate limit errors clear

---

## 2️⃣ **Frontend UI** (agent-max-desktop)

### **Mini Square (68x68)**
- [ ] Starts in mini mode
- [ ] Exactly 68x68 pixels
- [ ] No extra space around it
- [ ] Translucent (30% opacity)
- [ ] "MAX" text centered (14px font)
- [ ] Gradient text effect works
- [ ] Hover effect (50% opacity)
- [ ] Clickable (not blocked by drag)
- [ ] Click opens full chat immediately
- [ ] Can be dragged to reposition

### **Pill Mode (360x80)**
- [ ] Input bar shows correctly
- [ ] Placeholder text visible
- [ ] Cursor auto-focuses
- [ ] Typing expands to card mode
- [ ] Enter sends message
- [ ] Minimize button works
- [ ] Grip handle for dragging

### **Card Mode (360x520)**
- [ ] Full chat interface
- [ ] Conversation history visible
- [ ] Input field works
- [ ] Send button works
- [ ] Camera button works
- [ ] Screenshot indicator shows
- [ ] Minimize button collapses to pill
- [ ] Reset button clears chat
- [ ] Scrolling works smoothly

### **State Transitions**
- [ ] Mini → Card (click MAX)
- [ ] Card → Pill (minimize)
- [ ] Pill → Mini (minimize)
- [ ] Pill → Card (start typing)
- [ ] Keyboard shortcut: Cmd+Alt+C cycles
- [ ] Escape collapses to mini

### **Styling**
- [ ] Glassmorphism effect works
- [ ] Backdrop blur visible
- [ ] Colors consistent
- [ ] Shadows render correctly
- [ ] Hover effects smooth
- [ ] Animations smooth (no jank)
- [ ] Text readable on all backgrounds

---

## 3️⃣ **Electron App**

### **Window Management**
- [ ] Frameless window works
- [ ] Transparent background
- [ ] Always on top
- [ ] Resizable: true
- [ ] minWidth: 68, minHeight: 68
- [ ] maxWidth: 520, maxHeight: 520
- [ ] Window bounds checked (stays on screen)
- [ ] Position saved/restored

### **System Integration**
- [ ] App icon shows in dock/taskbar
- [ ] System tray icon (if applicable)
- [ ] Global keyboard shortcuts work
- [ ] Notifications work
- [ ] Copy to clipboard works
- [ ] Screenshot permission granted

### **Startup**
- [ ] App launches without errors
- [ ] Preload script loads
- [ ] IPC communication works
- [ ] Memory manager initializes
- [ ] Starts in mini mode (68x68)

### **Performance**
- [ ] CPU usage < 5% idle
- [ ] Memory usage < 100MB idle
- [ ] No memory leaks after 1 hour
- [ ] Fast window resizing
- [ ] Smooth animations

---

## 4️⃣ **Memory System**

### **Profile**
- [ ] User name saved
- [ ] Interaction count increments
- [ ] Profile persists after restart
- [ ] Can update profile
- [ ] Stats correct

### **Facts**
- [ ] Can save facts
- [ ] Facts organized by category
- [ ] Can retrieve facts
- [ ] Can delete facts
- [ ] Facts persist after restart

### **Conversations**
- [ ] Messages saved to history
- [ ] Recent messages retrieved correctly
- [ ] Conversation context built properly
- [ ] Session management works
- [ ] Can clear conversation

### **Preferences**
- [ ] Preferences saved
- [ ] Preferences retrieved
- [ ] Type detection works
- [ ] Defaults applied correctly

### **Storage**
- [ ] Files created at correct location
- [ ] JSON format valid
- [ ] File permissions correct
- [ ] Backup/export works
- [ ] Import restores data

---

## 5️⃣ **Screenshot Feature**

### **Capture**
- [ ] Screenshot button shows camera icon
- [ ] Click triggers screen capture
- [ ] Can select area (if applicable)
- [ ] Returns base64 data
- [ ] Data size < 10MB
- [ ] Blue indicator shows when attached

### **Processing**
- [ ] Base64 encoding valid
- [ ] Image quality good
- [ ] Compression appropriate
- [ ] No sensitive data in logs

### **Integration**
- [ ] Attaches to message payload
- [ ] Sent to backend correctly
- [ ] GPT-4o vision analyzes it
- [ ] Response mentions image content
- [ ] Debug info shows "Screenshot included"
- [ ] Screenshot clears after send

### **Error Handling**
- [ ] Permission denied handled
- [ ] Capture failure shows error
- [ ] No crash on error
- [ ] User can retry

---

## 6️⃣ **Semantic Embeddings**

### **Search**
- [ ] Debounced 800ms after typing
- [ ] Minimum 3 characters required
- [ ] API called with correct params
- [ ] Threshold 0.7 (70% similarity)
- [ ] Limit 3 results
- [ ] Results sorted by similarity

### **Suggestions Display**
- [ ] Dropdown appears below input
- [ ] "💡 Similar past conversations:" label
- [ ] Each suggestion shows goal text
- [ ] Similarity % displayed
- [ ] Checkmark for successful past queries
- [ ] Hover effect works

### **Interaction**
- [ ] Click suggestion fills input
- [ ] Suggestions disappear after click
- [ ] Input stays focused
- [ ] Can still type manually
- [ ] No suggestions for unique queries

### **Performance**
- [ ] No excessive API calls
- [ ] Embeddings cached on backend
- [ ] Rate limited (10 req/min)
- [ ] Fast response (< 2s)

---

## 7️⃣ **Chat & Messaging**

### **Sending Messages**
- [ ] Text input works
- [ ] Enter sends message
- [ ] Button sends message
- [ ] Message added to UI immediately
- [ ] User message labeled "YOU"
- [ ] Thinking indicator shows

### **Receiving Responses**
- [ ] Agent response labeled "AGENT MAX"
- [ ] Response formatted correctly
- [ ] No JSON shown to user
- [ ] Markdown rendered (if applicable)
- [ ] Links clickable

### **Message Types**
- [ ] User messages (blue theme)
- [ ] Agent messages (green theme)
- [ ] Thinking messages (subtle)
- [ ] Debug info (monospace)
- [ ] Error messages (red theme)

### **Chat Features**
- [ ] Conversation history shows
- [ ] Auto-scroll to bottom
- [ ] Can scroll up to read history
- [ ] Reset clears all messages
- [ ] Messages persist in memory

### **Input Validation**
- [ ] Min 2 characters enforced
- [ ] Max 2000 characters enforced
- [ ] Empty messages rejected
- [ ] Character count shown near limit
- [ ] Input disabled while thinking

---

## 8️⃣ **Error Handling**

### **Backend Errors**
- [ ] Backend down: Clear error message
- [ ] Timeout: Shows timeout message
- [ ] 500 error: Shows error details
- [ ] Network error: Retry prompt
- [ ] API key invalid: Clear message

### **Frontend Errors**
- [ ] Component crash: Error boundary catches
- [ ] State error: Recovers gracefully
- [ ] Memory error: Clear storage option
- [ ] Permission denied: Shows how to fix

### **User Errors**
- [ ] Empty message: Shows validation error
- [ ] Too long message: Shows character limit
- [ ] No screenshot: Works without it
- [ ] No internet: Clear offline message

### **Recovery**
- [ ] Can retry failed requests
- [ ] State restored after error
- [ ] No data loss on error
- [ ] User can continue using app

---

## 9️⃣ **Performance**

### **Speed**
- [ ] App launches < 3s
- [ ] Simple question response < 5s
- [ ] Screenshot analysis < 10s
- [ ] Semantic search < 2s
- [ ] Window resize < 100ms
- [ ] Input lag < 50ms

### **Resource Usage**
- [ ] CPU idle: < 5%
- [ ] CPU active: < 30%
- [ ] Memory idle: < 100MB
- [ ] Memory active: < 300MB
- [ ] Disk usage: < 50MB

### **Optimization**
- [ ] Images optimized
- [ ] API calls debounced
- [ ] Embeddings cached
- [ ] Lazy loading where possible
- [ ] No unnecessary re-renders

### **Stress Tests**
- [ ] 100 messages in conversation
- [ ] Multiple screenshots attached
- [ ] Long message (2000 chars)
- [ ] Rapid state transitions
- [ ] Run for 1+ hour

---

## 🔟 **Security**

### **API Keys**
- [ ] Never logged
- [ ] Never shown in UI
- [ ] Stored securely
- [ ] Environment variables used
- [ ] Not in screenshots

### **Data Privacy**
- [ ] User data encrypted (if applicable)
- [ ] Local storage only
- [ ] No telemetry without consent
- [ ] Clear privacy policy

### **Input Sanitization**
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] Command injection prevented
- [ ] Path traversal prevented

### **Permissions**
- [ ] Screenshot: Request permission
- [ ] File system: Minimal access
- [ ] Network: Only needed requests
- [ ] System: No elevated privileges

---

## 1️⃣1️⃣ **User Experience**

### **Onboarding**
- [ ] Welcome screen shows (if first time)
- [ ] Name collection works
- [ ] Role selection works
- [ ] Preferences saved
- [ ] Can skip onboarding

### **Discoverability**
- [ ] Features obvious to use
- [ ] Camera icon clear
- [ ] Suggestions discoverable
- [ ] Keyboard shortcuts documented
- [ ] Help/docs accessible

### **Feedback**
- [ ] Loading indicators show
- [ ] Progress bars accurate
- [ ] Success messages clear
- [ ] Error messages helpful
- [ ] Toast notifications work

### **Accessibility**
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast sufficient
- [ ] Text readable at all sizes
- [ ] Screen reader friendly (if applicable)

---

## 1️⃣2️⃣ **Cross-Platform**

### **macOS**
- [ ] App runs on macOS 10.15+
- [ ] Native menu works
- [ ] Keyboard shortcuts work (Cmd)
- [ ] Window vibrancy works
- [ ] Dock integration works
- [ ] Touch Bar support (if applicable)

### **Windows**
- [ ] App runs on Windows 10+
- [ ] Keyboard shortcuts work (Ctrl)
- [ ] Taskbar integration works
- [ ] Window transparency works
- [ ] System tray works

### **Linux**
- [ ] App runs on Ubuntu 20.04+
- [ ] AppImage works
- [ ] .deb package installs
- [ ] Window manager compatible
- [ ] System tray works

### **Build Process**
- [ ] macOS: DMG builds correctly
- [ ] Windows: NSIS installer works
- [ ] Linux: AppImage works
- [ ] Code signing works (macOS/Windows)
- [ ] Auto-update works

---

## 1️⃣3️⃣ **Edge Cases**

### **Network**
- [ ] Works offline (cached responses)
- [ ] Reconnects after network loss
- [ ] Handles slow connections
- [ ] Timeout recovery works

### **System**
- [ ] Multiple monitors supported
- [ ] Screen resolution changes handled
- [ ] Low disk space warning
- [ ] Low memory handling

### **User Behavior**
- [ ] Rapid clicking handled
- [ ] Double-send prevented
- [ ] Empty conversation history
- [ ] Very long messages
- [ ] Special characters in input

### **Data**
- [ ] Large conversation history
- [ ] Many screenshots
- [ ] Corrupted memory files
- [ ] Migration from old versions

---

## 1️⃣4️⃣ **Integration**

### **Backend ↔ Frontend**
- [ ] API calls succeed
- [ ] Responses parsed correctly
- [ ] Errors handled properly
- [ ] Timeouts work
- [ ] Retries work

### **Electron ↔ React**
- [ ] IPC communication works
- [ ] Preload script loaded
- [ ] Events handled correctly
- [ ] State synchronized

### **Memory ↔ Chat**
- [ ] Messages saved
- [ ] Context retrieved
- [ ] Facts used in responses
- [ ] Profile info accessible

### **Screenshots ↔ Vision API**
- [ ] Base64 encoding correct
- [ ] Sent to GPT-4o vision
- [ ] Response includes image analysis
- [ ] Large images handled

---

## 1️⃣5️⃣ **Documentation**

### **User Docs**
- [ ] README clear
- [ ] Installation instructions
- [ ] Usage guide
- [ ] Troubleshooting section
- [ ] FAQ

### **Developer Docs**
- [ ] Code commented
- [ ] API documented
- [ ] Architecture explained
- [ ] Setup guide
- [ ] Contributing guide

### **Testing Docs**
- [ ] Test guide complete
- [ ] Test cases documented
- [ ] CI/CD configured
- [ ] Coverage reports

---

## ✅ **Pre-Launch Checklist Summary**

### **Must Fix Before Launch:**
- [ ] Mini square clickable (68x68, no extra space)
- [ ] All three states work
- [ ] Screenshots capture and send
- [ ] Semantic suggestions show
- [ ] Chat sends and receives
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Works on target platforms

### **Critical Tests:**
- [ ] End-to-end: Open app → Send message → Get response
- [ ] Screenshots: Take → Attach → Send → Analyze
- [ ] Suggestions: Type → See suggestions → Click → Send
- [ ] States: Mini → Card → Pill → Mini
- [ ] Memory: Send messages → Restart → History persists

### **Sign-Off:**
- [ ] All automated tests pass
- [ ] All manual tests pass
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Documentation complete
- [ ] Builds successfully
- [ ] Ready for beta testing

---

## 🔧 **Testing Tools**

### **Automated**
```bash
# Frontend tests
cd agent-max-desktop
npm test

# Backend tests
cd Agent_Max
pytest

# E2E tests
npm run test:e2e
```

### **Manual**
1. Start backend: `cd Agent_Max && ./start_api.sh`
2. Start frontend: `cd agent-max-desktop && ./start_app.sh`
3. Follow test scenarios
4. Document results

### **Monitoring**
- Console logs
- Network tab (Dev Tools)
- Performance profiler
- Memory profiler
- Error tracking

---

## 📊 **Testing Priority**

### **P0 (Must Work):**
1. Mini square clickable
2. Chat sends/receives messages
3. Basic UI functional
4. No crashes

### **P1 (Should Work):**
1. Screenshots
2. Semantic suggestions
3. State transitions
4. Memory persistence

### **P2 (Nice to Have):**
1. Performance optimizations
2. Advanced features
3. Polish
4. Extra platforms

---

## 🚨 **Known Issues to Test**

Based on development history:

1. **Mini square has extra space** - Electron window constraints
2. **Clicks not working** - `-webkit-app-region: drag` blocking
3. **JSON responses shown** - Need to parse and extract text
4. **Slow responses** - Need to use GPT-4o-mini with low reasoning
5. **Screenshots not working** - Image parameter not passed to backend
6. **No suggestions** - Embeddings API not integrated
7. **Window sizing** - Fixed width/height preventing resize

---

**Test thoroughly. Ship confidently.** 🚀
