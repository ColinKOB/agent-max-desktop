# 🧪 Testing Guide - Screenshots & Embeddings

**Last Updated:** October 10, 2025, 1:15 PM

---

## 📋 **Table of Contents**

1. [Automated Tests](#automated-tests)
2. [Manual Testing](#manual-testing)
3. [Best Practices Checklist](#best-practices-checklist)
4. [Common Issues](#common-issues)

---

## 🤖 **Automated Tests**

### **Setup**

```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop

# Install test dependencies (if not already installed)
npm install -D vitest @vitest/ui

# Run tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### **Test Files**

- `tests/features.test.js` - Screenshot & embeddings tests

### **What's Tested**

#### **Screenshot Feature:**
- ✅ Captures screenshot and returns base64 data
- ✅ Handles errors gracefully
- ✅ Validates screenshot size (< 10MB)
- ✅ Includes screenshot in message payload
- ✅ Clears screenshot after sending

#### **Semantic Embeddings:**
- ✅ Finds similar goals with valid similarity scores
- ✅ Handles no results found
- ✅ Validates similarity scores (0-1 range)
- ✅ Respects threshold parameter
- ✅ Respects limit parameter
- ✅ Handles API errors gracefully
- ✅ Debounces search requests (800ms)
- ✅ Gets embedding vector (1536 dimensions)

#### **Integration:**
- ✅ End-to-end screenshot + message flow
- ✅ Semantic suggestions while typing

#### **Best Practices:**
- ✅ No sensitive data exposure
- ✅ Rate limiting (10 requests/min)
- ✅ Embedding caching
- ✅ Input validation (2-2000 chars)
- ✅ Concurrent request handling

---

## 🖱️ **Manual Testing**

### **Test 1: Mini Square Size & Appearance**

**Objective:** Verify 68x68 square is properly sized and translucent

**Steps:**
1. Start the app: `./start_app.sh`
2. App should appear as small 68x68 square
3. Text "MAX" should be centered and readable (14px font)
4. Background should be translucent (30% opacity)
5. You should see desktop through the square

**Expected Result:**
- ✅ Square is 68x68 pixels (25% smaller than before)
- ✅ No empty space around "MAX" text
- ✅ Translucent glass effect
- ✅ Hover makes it slightly more visible (50% opacity)

**Pass Criteria:**
- [ ] Square is compact (no extra space)
- [ ] Text is centered and visible
- [ ] See-through background
- [ ] Hover effect works

---

### **Test 2: Screenshot Capture**

**Objective:** Test screenshot functionality end-to-end

**Steps:**
1. Open Agent Max (click "MAX" square)
2. Click the camera icon (📷)
3. Select an area to capture
4. Small blue dot should appear on camera icon
5. Type: "What is this?"
6. Press Enter
7. Wait for response

**Expected Result:**
- ✅ Screenshot captured successfully
- ✅ Blue indicator shows screenshot is attached
- ✅ Message sent with screenshot
- ✅ AI analyzes the image content
- ✅ Response mentions what's in the screenshot
- ✅ Debug info shows "Screenshot was included in request"
- ✅ Screenshot clears after sending

**Pass Criteria:**
- [ ] Camera button works
- [ ] Screenshot indicator appears
- [ ] Screenshot sent with message
- [ ] AI response analyzes image
- [ ] Screenshot clears after send

**Sample Questions:**
- "What is this?"
- "Describe what you see"
- "What programming language is this?"
- "Read the text in this image"

---

### **Test 3: Semantic Suggestions**

**Objective:** Test real-time similar conversation suggestions

**Prerequisites:** You must have sent at least one message before for suggestions to work

**Steps:**
1. Open Agent Max
2. Type slowly: "why is grass"
3. Wait 1 second (debounce delay)
4. Suggestions should appear below input
5. Check similarity scores (should be > 70%)
6. Click on a suggestion
7. Input should be filled with that text

**Expected Result:**
- ✅ Suggestions appear after 800ms of no typing
- ✅ Shows "💡 Similar past conversations:"
- ✅ Lists up to 3 similar questions
- ✅ Each shows similarity percentage
- ✅ Checkmark (✓) appears for successful past queries
- ✅ Clicking fills the input
- ✅ Suggestions disappear after click

**Pass Criteria:**
- [ ] Debounce works (waits 800ms)
- [ ] Suggestions appear correctly
- [ ] Similarity scores shown
- [ ] Click-to-fill works
- [ ] UI is smooth and responsive

**Test Queries:**
```
Type: "why is grass"
Expected: Should suggest "Why is grass green?" if asked before

Type: "how do"
Expected: Should suggest similar "how do..." questions

Type: "what is"  
Expected: Should suggest similar "what is..." questions

Type: "unique query never asked"
Expected: No suggestions (this is good!)
```

---

### **Test 4: Combined Test (Screenshot + Embeddings)**

**Objective:** Test both features working together

**Steps:**
1. Take a screenshot of some code
2. Start typing: "what language"
3. Wait for suggestions
4. If suggested "What language is this?", click it
5. Press Enter with screenshot attached
6. Verify response analyzes both the code and answers the question

**Expected Result:**
- ✅ Screenshot attached (blue dot)
- ✅ Suggestions work even with screenshot
- ✅ AI responds to both image + text
- ✅ Debug shows screenshot was included

---

### **Test 5: Error Handling**

**Objective:** Ensure graceful error handling

**Scenario A: Backend Down**
1. Stop the backend API
2. Try to send a message
3. Should show error message
4. Should not crash the app

**Scenario B: Screenshot Permission Denied**
1. Deny screenshot permissions (if possible)
2. Click camera icon
3. Should show error toast
4. Should not crash

**Scenario C: No Similar Results**
1. Type something brand new
2. No suggestions should appear
3. No console errors
4. Input should still work

**Pass Criteria:**
- [ ] Clear error messages shown
- [ ] No app crashes
- [ ] User can recover from errors
- [ ] Console errors are descriptive

---

## ✅ **Best Practices Checklist**

### **Security:**
- [ ] No API keys in screenshot data
- [ ] No passwords visible in debug info
- [ ] Base64 data properly encoded
- [ ] No sensitive data in logs

### **Performance:**
- [ ] Debouncing works (800ms)
- [ ] No excessive API calls
- [ ] Embeddings are cached
- [ ] Screenshot size < 10MB
- [ ] UI remains responsive

### **User Experience:**
- [ ] Clear loading indicators
- [ ] Helpful error messages
- [ ] Smooth animations
- [ ] Keyboard shortcuts work
- [ ] Auto-focus on expand

### **Code Quality:**
- [ ] TypeScript/JSDoc comments
- [ ] Error boundaries implemented
- [ ] Proper state management
- [ ] No memory leaks
- [ ] Clean console (no warnings)

---

## 🐛 **Common Issues**

### **Issue 1: Suggestions Not Appearing**

**Symptoms:** Type text but no suggestions show up

**Possible Causes:**
1. Backend not running
2. No past conversations in database
3. Typing too fast (< 3 characters)
4. Similarity threshold too high

**Solutions:**
```bash
# 1. Check backend is running
curl http://localhost:8000/health

# 2. Send a few test messages first to build history

# 3. Wait 1 second after typing

# 4. Check backend logs for errors
```

---

### **Issue 2: Screenshot Not Captured**

**Symptoms:** Camera icon does nothing or shows error

**Possible Causes:**
1. Permissions not granted
2. Screen recording permission needed on macOS
3. Electron API not initialized

**Solutions:**
```
1. Check System Preferences → Security → Screen Recording
2. Grant permission to Agent Max
3. Restart the app after granting permission
```

---

### **Issue 3: Mini Square Still Has Empty Space**

**Symptoms:** Window is wider than 68px

**Possible Causes:**
1. CSS not updated
2. Window resize not triggered
3. Electron window constraints

**Solutions:**
1. Hard refresh app (Cmd+Shift+R)
2. Check CSS file was saved
3. Check electron window size in main.cjs
```

---

### **Issue 4: Slow Response Times**

**Symptoms:** Takes > 10s to get a response

**Possible Causes:**
1. Using GPT-4o instead of GPT-4o-mini
2. Backend not using correct model
3. Network latency
4. OpenAI API slow

**Solutions:**
```python
# Check backend is using gpt-4o-mini with low reasoning:
result = call_llm(
    messages=messages,
    max_tokens=500,
    model="gpt-4o-mini",  # ← Should be mini
    reasoning_effort="low"  # ← Should be low
)
```

---

## 📊 **Test Results Template**

Use this template to document your test results:

```markdown
## Test Session: [Date]

### Environment:
- App Version: 1.0.0
- Backend: Running/Not Running
- OS: macOS [version]

### Test 1: Mini Square Size
- Status: ✅ Pass / ❌ Fail
- Notes: [Any observations]

### Test 2: Screenshot Capture
- Status: ✅ Pass / ❌ Fail
- Screenshot Size: [KB]
- Response Time: [seconds]
- Notes: [Any observations]

### Test 3: Semantic Suggestions
- Status: ✅ Pass / ❌ Fail
- Suggestions Shown: [count]
- Similarity Scores: [list scores]
- Notes: [Any observations]

### Test 4: Combined Test
- Status: ✅ Pass / ❌ Fail
- Both Features Working: Yes/No
- Notes: [Any observations]

### Test 5: Error Handling
- Status: ✅ Pass / ❌ Fail
- Errors Handled Gracefully: Yes/No
- Notes: [Any observations]

### Overall Result: ✅ All Pass / ⚠️ Some Fail / ❌ Failed

### Issues Found:
1. [Issue description]
2. [Issue description]

### Recommendations:
1. [Recommendation]
2. [Recommendation]
```

---

## 🚀 **Quick Test Commands**

```bash
# Run automated tests
npm test

# Run specific test file
npm test tests/features.test.js

# Run with watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run only screenshot tests
npm test -- --grep "Screenshot"

# Run only embeddings tests  
npm test -- --grep "Semantic"
```

---

## 📝 **Reporting Issues**

When reporting issues, include:

1. **Test that failed:** [Test name]
2. **Steps to reproduce:** [Detailed steps]
3. **Expected result:** [What should happen]
4. **Actual result:** [What happened]
5. **Screenshots:** [If applicable]
6. **Console logs:** [Any errors]
7. **Environment:** [OS, app version, backend status]

---

**Happy Testing!** 🎉

All features should pass these tests. If you find any issues, document them and we can fix them immediately.
