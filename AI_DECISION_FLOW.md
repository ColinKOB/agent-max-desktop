# 🤖 AI Decision Flow - What the AI Sees

**Date:** October 11, 2025, 8:35 AM  
**Purpose:** Show exactly what questions/prompts the AI receives at each stage

---

## 📊 Request Flow Overview

```
User Input
    ↓
1. DECISION: Execute or Respond?
    ↓
2a. RESPOND Mode          2b. EXECUTE Mode
    (Simple answer)           (Multi-step commands)
    ↓                         ↓
3. Generate Response      3. Loop: Plan → Execute → Evaluate
    ↓                         ↓
4. Return to User         4. Return to User
```

---

## Stage 1: Initial Decision (Execute vs Respond)

### What AI Receives:

```
You are a classification system. Analyze the user's request and respond with ONLY one word: EXECUTE or RESPOND

EXECUTE - if the request needs:
- Installing/downloading applications (Notion, Figma, VS Code, etc.)
- System commands (whois, ping, curl, ls, brew, apt, etc.)
- Real-time data (domain availability, website status, file checks)
- External tool usage (browser, file operations, installations)
- Technical operations (create/delete files, run scripts)
- Information lookup (weather, news, search results, videos)
- Web browsing (finding content, checking websites)
- System information queries

RESPOND - if the request is:
- General knowledge questions (no real-time data needed)
- Explanations or definitions
- Conversational queries
- Hypothetical scenarios
- Creative writing tasks

Examples:
"Download Notion" → EXECUTE
"Install Figma" → EXECUTE
"Is agentmax.com available?" → EXECUTE
"What is a dog's favorite color?" → RESPOND
"Check if google.com is up" → EXECUTE
"Explain quantum computing" → RESPOND
"Find all Python files" → EXECUTE
"Why is the sky blue?" → RESPOND
"What's the weather?" → EXECUTE
"Get VS Code" → EXECUTE

User request: [YOUR MESSAGE HERE]

Classification:
```

### Example Decisions:

| User Input | AI Sees | Decision | Why |
|------------|---------|----------|-----|
| "Hey! What can you help me out with?" | Full prompt above | RESPOND | General question |
| "I live in sicklerville New Jersey. How is the weather there?" | Full prompt above | RESPOND | Weather mentioned but also conversational |
| "Can you open that on the web for me?" | Full prompt above | EXECUTE | "open" keyword triggers |

---

## Stage 2a: RESPOND Mode (Simple Conversational)

### What AI Receives:

```
You are Agent Max, a helpful AI assistant.
        
User: Colin
User's Location: Sicklerville

Recent conversation:
user: Hey! What can you help me out with?
assistant: Hi Colin — I can help with lots of things...
user: I live in sicklerville New Jersey. How is the weather there?
assistant: Here's the live weather for Sicklerville, NJ: https://weather.com/...
user: Can you open that on the web for me?

IMPORTANT - Adaptive Problem Solving:
When you can't perform an action directly, provide intelligent workarounds:
- For weather: If you can't access weather data, provide a clickable link like: https://weather.com/weather/today/l/[City]+[State]
- For searches: Provide Google search links: https://www.google.com/search?q=[query]
- For videos: Provide YouTube search links: https://www.youtube.com/results?search_query=[query]
- For maps: Provide Google Maps links: https://www.google.com/maps/search/[location]

Format links as plain URLs on their own line - they will be clickable in the UI.
If you need information from the user (like location), ask directly rather than saying "I don't have access."

Respond naturally and helpfully to the user's request.
```

### Problem with RESPOND Mode:
- ❌ Doesn't know it CAN execute commands
- ❌ Only provides links, not actual actions
- ❌ "Can you open that" should trigger EXECUTE mode

---

## Stage 2b: EXECUTE Mode (Multi-Step Commands)

### What AI Receives:

```
You are Agent Max, an autonomous AI agent with command execution capabilities.

User: Colin
User's Location: Sicklerville
Operating System: Darwin

Recent conversation:
user: Can you open that on the web for me?
assistant: Here's the live weather for Sicklerville, NJ: https://weather.com/...

CAPABILITIES:
- Execute terminal commands (file operations, system info, installations, network checks, opening URLs/apps)
- Provide information and guidance
- Generate helpful links when direct access isn't available

For each step, output ONLY valid JSON:
{
  "reasoning": "explain your thinking and approach",
  "action": "execute_command" or "respond" or "done",
  "command": "exact shell command" (if execute_command),
  "response": "your response to user" (if respond or done)
}

DECISION FRAMEWORK:
Ask yourself:
1. Can I accomplish this with a terminal command? → execute_command
2. Should I provide a link or information? → respond
3. Am I done with the task? → done

AVAILABLE COMMANDS (Darwin):
- Open URLs: open "https://example.com" (macOS), xdg-open (Linux)
- Install apps: brew install --cask [app] (macOS)
- File operations: ls, cat, mkdir, find, grep, rm
- System info: sw_vers, uname, hostname, ps
- Network: ping, curl, whois

WHEN YOU CAN'T DIRECTLY ACCESS DATA:
- Weather → weather.com link with location
- Restaurants/places → Google Maps search link
- Videos → YouTube search link
- General search → Google search link

Current goal: Can you open that on the web for me?

Think through the best approach. Execute commands when possible, provide helpful alternatives when not.
Output ONLY the JSON.
```

### Expected AI Response:

```json
{
  "reasoning": "User wants to open the weather link I just provided. I can use the 'open' command on macOS to open it in their default browser.",
  "action": "execute_command",
  "command": "open \"https://weather.com/weather/today/l/sicklerville+New+Jersey\""
}
```

### After Command Executes:

```
Command output:
[empty - open command doesn't produce output]

What's next?
```

### AI's Next Response:

```json
{
  "reasoning": "Successfully opened the weather page in the browser. Task complete.",
  "action": "done",
  "response": "Opened the weather page in your browser!"
}
```

---

## 🔍 What Went Wrong in Your Example

### Request: "Can you open that on the web for me?"

#### Stage 1: Decision
```
Keyword check: "open" found → Should trigger EXECUTE ✅
BUT: May have gone to RESPOND mode instead ❌
```

#### Stage 2: RESPOND Mode (Wrong!)
```
AI receives conversational prompt
Tries to respond with text
Doesn't know it can execute commands
Returns empty response → "No response provided" ❌
```

#### What SHOULD Have Happened:

```
Stage 1: "open" keyword → EXECUTE mode ✅
Stage 2: EXECUTE mode prompt ✅
AI thinks: "I can use 'open' command" ✅
AI returns: {"action": "execute_command", "command": "open \"https://...\""} ✅
System executes: open https://weather.com/... ✅
Browser opens ✅
AI returns: {"action": "done", "response": "Opened in browser!"} ✅
```

---

## 🎯 Hard-Coded vs AI-Thinking

### Current Hard-Coded Responses:

#### 1. Weather Links (RESPOND Mode)
```python
# Line 260-264 in autonomous_api_wrapper.py
"For weather: If you can't access weather data, provide a clickable link like: 
https://weather.com/weather/today/l/[City]+[State]"
```

**Problem:** AI is TOLD to provide links instead of THINKING about executing commands

**Better:** Let AI decide:
- Can I get weather data? No
- Can I open a weather link? Yes, with `open` command
- Should I just provide a link? Only if user asks for info, not action

---

#### 2. Restaurant Links (RESPOND Mode)
```python
# Line 486-487
"Real-time restaurant/place searches → Provide Google Maps link"
```

**Problem:** Pre-scripted response

**Better:** AI should think:
- User wants restaurants near Sicklerville
- I can't search Google Maps API
- I CAN open Google Maps in browser with `open` command
- Or provide link if they just want info

---

#### 3. Execution Examples (EXECUTE Mode)
```python
# Lines 493-515 (OLD VERSION)
Goal: "look up restaurants near me"
Step 1:
{
  "reasoning": "User wants restaurants but we can't access Google Maps API. Provide helpful link.",
  "action": "respond",
  "response": "I can't directly search restaurants, but here's a Google Maps link..."
}
```

**Problem:** Tells AI exactly what to do for specific scenarios

**Better:** Let AI reason through it

---

## ✅ Improvements Made

### 1. Removed Prescriptive Examples
**Before:**
```python
EXAMPLES:
Goal: "look up restaurants near me"
Step 1: { "action": "respond", "response": "Here's a link..." }
```

**After:**
```python
DECISION FRAMEWORK:
Ask yourself:
1. Can I accomplish this with a terminal command? → execute_command
2. Should I provide a link or information? → respond
3. Am I done with the task? → done
```

**Why Better:** AI thinks through each request instead of pattern-matching

---

### 2. Added "open" to Execution Keywords
**Before:** "open" might not trigger EXECUTE mode

**After:** "open", "launch", "start" all trigger EXECUTE mode

**Why Better:** "Can you open that" now correctly enters EXECUTE mode

---

### 3. Better Error Handling
**Before:**
```python
if not final_response:
    final_response = "No response provided"
```

**After:**
```python
if not final_response:
    print(f"[ERROR] AI returned empty response. Raw: {response_text}")
    final_response = "I apologize, I had trouble generating a response. Could you rephrase?"
```

**Why Better:** Logs the actual error for debugging + helpful message to user

---

## 🎯 Remaining Hard-Coded Elements

### ✅ Good Hard-Coding (Guard Rails):

#### 1. JSON Format Requirement
```python
For each step, output ONLY valid JSON:
{
  "reasoning": "...",
  "action": "execute_command" or "respond" or "done",
  ...
}
```
**Why Good:** Ensures parseable responses

---

#### 2. Available Commands List
```python
AVAILABLE COMMANDS (Darwin):
- Open URLs: open "https://example.com"
- Install apps: brew install --cask [app]
- File operations: ls, cat, mkdir, find, grep, rm
```
**Why Good:** Teaches AI what tools it has

---

#### 3. OS Detection
```python
os_type = platform.system()  # Darwin, Linux, Windows
```
**Why Good:** Provides context for platform-specific commands

---

### ⚠️ Questionable Hard-Coding:

#### 1. Alternative Suggestions (RESPOND Mode)
```python
"For weather: provide a clickable link like: https://weather.com/..."
"For searches: Provide Google search links: https://www.google.com/search?q=..."
```

**Problem:** Too prescriptive

**Better Approach:**
```python
WHEN YOU CAN'T DIRECTLY ACCESS DATA:
Think about what the user needs:
- Information only? → Provide a helpful link
- Action needed? → Execute a command to open/launch something
- Both? → Execute command AND explain what you did
```

---

#### 2. Keyword-Based Decision
```python
execution_indicators = [
    "install", "download", "open", "search", "find", ...
]

if any(indicator in goal_lower for indicator in execution_indicators):
    return "execute"
```

**Problem:** Rigid pattern matching

**Better Approach:** Let GPT-5 decide based on intent, not keywords

**Compromise:** Keep keywords as FALLBACK, but trust AI decision first

---

## 💡 Suggested Improvements

### 1. Remove Hard-Coded Link Suggestions from RESPOND Mode

**Current:**
```python
"For weather: provide link like https://weather.com/..."
```

**Better:**
```python
"If you can't access real-time data, think about:
- Can I execute a command to help? (open URL, run script, etc.)
- Should I provide information or a link?
- What would be most helpful to the user?"
```

---

### 2. Simplify Decision Prompt

**Current:** Long list of examples

**Better:**
```
Classify this request:

EXECUTE - if it requires:
- Running commands
- Accessing files/system
- Opening/launching things
- Installing/downloading
- Real-time operations

RESPOND - if it's:
- General knowledge
- Explanations
- Conversational

User request: {goal}
Classification:
```

---

### 3. Trust AI More in EXECUTE Mode

**Current:** Tells AI exactly what to do for weather, restaurants, etc.

**Better:**
```
You have these capabilities:
1. Execute terminal commands
2. Open URLs/apps
3. Provide information

Current goal: {goal}

Think step by step:
- What does the user want?
- What can I do to help?
- What's the best approach?

Output your decision as JSON.
```

---

### 4. Add Conversation Context to Decision

**Current:** Decision only sees the goal

**Better:** Decision sees recent conversation
```
Recent messages:
- User: "How's the weather in Sicklerville?"
- You: "Here's a link: https://weather.com/..."
- User: "Can you open that on the web for me?"

Now classify: Does "Can you open that" need EXECUTE or RESPOND?
Answer: EXECUTE (user wants action, not info)
```

---

## 📋 Summary: Hard-Coded vs AI-Thinking

### Current Hard-Coding:

| Element | Type | Keep? | Why |
|---------|------|-------|-----|
| JSON format requirement | Guard rail | ✅ Yes | Ensures parseable output |
| Available commands list | Context | ✅ Yes | Teaches AI its tools |
| OS detection | Context | ✅ Yes | Platform-specific help |
| Keyword execution triggers | Fallback | ⚠️ Maybe | Useful backup, but trust AI first |
| Weather link template | Prescriptive | ❌ No | Let AI think |
| Restaurant link template | Prescriptive | ❌ No | Let AI think |
| Example responses | Prescriptive | ❌ No | Let AI reason |

---

### Ideal Approach:

```
1. Provide CONTEXT (what tools exist, what OS, user info)
2. Provide GUARD RAILS (output format, safety rules)
3. Provide DECISION FRAMEWORK (how to think through problems)
4. Let AI REASON (don't prescribe specific responses)
5. Use keywords as FALLBACK (if AI decision fails)
```

---

## 🎯 Next Steps

### Immediate Fixes:
1. ✅ Added "open", "launch", "start" to keywords
2. ✅ Better error logging for empty responses
3. ✅ Simplified EXECUTE prompt (less prescriptive)

### Future Improvements:
1. Remove hard-coded link templates
2. Add conversation context to decision stage
3. Trust AI more, use keywords as fallback only
4. Add "thinking" step where AI explains its reasoning

---

**The goal:** Let AI think like a smart assistant, not follow a script.

*Document created: October 11, 2025, 8:35 AM*
