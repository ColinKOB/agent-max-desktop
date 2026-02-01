# Agent Max Capability Audit

**Created:** 2026-01-31
**Purpose:** Track advertised capabilities vs actual functionality

---

## 🔴 HIGH RISK - Likely Not Fully Working / Need Testing

### 1. App-Specific Prompts (from app-capabilities.json)
Many of these prompts imply deep integration that may not exist:

| App | Advertised Prompt | Concern | Status |
|-----|------------------|---------|--------|
| **Notion** | "Create a new page in Notion for my meeting notes" | Can Max actually create Notion pages via API? | ❓ Untested |
| **Calendar** | "Schedule a meeting for tomorrow at 2pm" | Does Max have calendar write access? | ❓ Untested |
| **Reminders** | "Remind me to call mom tomorrow at 5pm" | Can it create reminders? | ❓ Untested |
| **Things/Todoist/OmniFocus** | "Add a task to [app]" | Task creation API? | ❓ Untested |
| **Slack** | "Send a message to #general on Slack" | Slack API integration? | ❓ Untested |
| **Mail** | "Send an email to john@example.com about the project" | Can it actually send emails? | ❓ Untested |
| **Contacts** | "Find John's phone number in Contacts" | Contacts API access? | ❓ Untested |
| **Notes** | "Create a note called 'Meeting Notes'" | AppleScript/API? | ❓ Untested |
| **Salesforce/HubSpot/Zendesk** | Various CRM operations | No integrations visible | ❓ Untested |
| **Google Sheets/Docs/Slides** | "Create a new Google Sheet for my budget" | Google API integration status? | ❓ Untested |

### 2. Autonomous Mode Claims
From onboarding (`OnboardingFlow.jsx` lines 1642-1764):
- **"Controls mouse & keyboard"** - Does this actually work reliably? ❓ Untested
- **"Opens apps & websites"** - Partially works but needs verification ❓ Untested
- **"Completes multi-step tasks"** - Complex workflows need testing ❓ Untested

### 3. "Custom Workflows" (Pro Plan)
- Advertised as a Pro feature but is there actual UI for creating custom workflows? ❓ Untested

---

## 🟡 MEDIUM RISK - Partially Working / May Have Issues

### 4. File Operations
| Capability | Status |
|------------|--------|
| "Organize my downloads folder" | ❓ Untested |
| "Find all PDFs on my Desktop" | ❓ Untested |
| "Move this file to the Documents folder" | ❓ Untested |

### 5. Web Actions
| Capability | Status |
|------------|--------|
| "Find flights to Tokyo for next week" | ❓ Untested |
| "Compare prices for AirPods across different stores" | ❓ Untested |
| "Go to amazon.com and find headphones" | ❓ Untested |

### 6. Google Integration (Premium)
- "Google integration" listed as Premium feature - What exactly does this include? ❓ Untested
- Gmail, Calendar, Sheets access? ❓ Untested

### 7. Agent Templates
From `CreateAgentPremium.jsx`:
| Template | Claimed Capabilities | Status |
|----------|---------------------|--------|
| Research Agent | Web Search, Data Analysis, Report Generation | ❓ Untested |
| Code Assistant | Code Review, Bug Fixing, Documentation | ❓ Untested |
| Data Analyst | SQL Queries, Visualization, Statistical Analysis | ❓ Untested |
| Content Writer | Blog Posts, Documentation, Copy Editing | ❓ Untested |

---

## 🟢 LOW RISK - Likely Working

### 8. Core Chat Features
| Capability | Status |
|------------|--------|
| Question answering | ✅ Confirmed |
| Brainstorming & ideation | ✅ Confirmed |
| Writing assistance | ✅ Confirmed |
| Reading/analyzing uploaded files | ❓ Untested |

### 9. Basic App Launching
- "Open [App]" / "Switch to [App]" - Simple app launching ❓ Untested

### 10. Conversation Memory
- "I'll still remember who you are" - Supabase memory ❓ Untested

### 11. Settings & Customization
- Mode switching (Chatty/Auto) ✅ Confirmed
- Personality adjustments ❓ Untested

---

## Testing Priority Order

1. **Email sending** - Can Max actually send emails via Mail app?
2. **Calendar creation** - Can it create calendar events?
3. **Task creation** - Reminders, Things, Todoist integration?
4. **Slack/Discord messaging** - Actual message sending?
5. **File organization** - Autonomous folder management?
6. **Google integration** - What's actually connected?
7. **CRM tools** - Salesforce, HubSpot claims seem aspirational
8. **Custom workflows** - Does this Pro feature exist?

---

## Test Results Log

### Test 1: Salesforce CRM
- **Date:** 2026-01-31
- **Input:** "Check my sales pipeline in Salesforce"
- **Expected Result:** Show sales pipeline data
- **Actual Result:** Failed - tried autonomous screenshot which failed, no actual Salesforce API integration
- **Status:** ❌ Fail

### Test 2: Apple Notes - Create Note
- **Date:** 2026-01-31
- **Input:** "Create a new note in the Notes app with the title 'Test Note from Max' and content..."
- **Expected Result:** Note created in Notes app
- **Actual Result:** Note successfully created via AppleScript
- **Status:** ✅ Pass

### Test 3: Calendar - Create Event
- **Date:** 2026-01-31
- **Input:** "Create a calendar event for tomorrow at 3pm called 'Agent Max Test Meeting' that lasts 30 minutes"
- **Expected Result:** Calendar event created
- **Actual Result:** Event successfully created via AppleScript
- **Status:** ✅ Pass

### Test 4: Reminders - Create Reminder
- **Date:** 2026-01-31
- **Input:** "Create a reminder called 'Test Reminder from Agent Max' due tomorrow at 10am"
- **Expected Result:** Reminder created
- **Actual Result:** Max claimed success, verification AppleScript hung (needs manual check)
- **Status:** ⚠️ Unverified

### Test 5: Notion - Create Page
- **Date:** 2026-01-31
- **Input:** "Open the Notion app and create a new page called 'Agent Max Test Page'..."
- **Expected Result:** Notion page created
- **Actual Result:** "Maximum steps exceeded" - tried autonomous mode, failed
- **Status:** ❌ Fail

### Test 6: Mail - Create Draft Email
- **Date:** 2026-01-31
- **Input:** "Create a draft email in the Mail app to test@example.com with subject 'Test from Agent Max'..."
- **Expected Result:** Email draft created
- **Actual Result:** Email compose window opened with correct recipient, subject, and body
- **Status:** ✅ Pass

### Test 7: File Operations - Create Folder and File
- **Date:** 2026-01-31
- **Input:** "Create a new folder on my Desktop called 'Agent Max Test Folder' and create a text file inside it..."
- **Expected Result:** Folder and file created
- **Actual Result:** Folder and test.txt created successfully with correct content
- **Status:** ✅ Pass

### Test 8: Signal - Send Message
- **Date:** 2026-01-31
- **Input:** "Open Signal and send a message to my most recent conversation..."
- **Expected Result:** Message sent via Signal
- **Actual Result:** Request failed silently - no response generated
- **Status:** ❌ Fail

### Test 9: Contacts - Find Contact
- **Date:** 2026-01-31
- **Input:** "Find the phone number for anyone named 'John' in my Contacts app"
- **Expected Result:** Return contact info
- **Actual Result:** Max admitted "I don't have direct access to your Contacts app"
- **Status:** ❌ Fail

### Test 10: Google Sheets - Create Spreadsheet
- **Date:** 2026-01-31
- **Input:** "Open Google Sheets and create a new spreadsheet called 'Agent Max Test' with column headers..."
- **Expected Result:** Spreadsheet created
- **Actual Result:** Max claimed success - NEEDS MANUAL VERIFICATION
- **Status:** ⚠️ Unverified (awaiting user confirmation)

### Test 11: ChatGPT - Open and Interact
- **Date:** 2026-01-31
- **Input:** "Open ChatGPT and ask it: What is 2+2?"
- **Expected Result:** Open ChatGPT and type query
- **Actual Result:** Stuck/timeout after 4+ minutes (autonomous mode failed)
- **Status:** ❌ Fail

---

## FIX LIST - Integration Opportunities (Research Complete)

### ✅ SALVAGEABLE WITH API INTEGRATION

Based on detailed research, these apps have official APIs and CAN be integrated:

---

#### 1. **Salesforce** - ✅ CAN BE FIXED
**Solution:** Use `jsforce` npm package with OAuth 2.0
- **Package:** `npm install jsforce`
- **Auth:** OAuth 2.0 (requires user to create Connected App in Salesforce)
- **Capabilities:** Full SOQL queries for Opportunities, Pipeline, Contacts
- **Example:** Query open opportunities with `SELECT Id, Name, Amount, StageName FROM Opportunity WHERE IsClosed = false`
- **Effort:** Medium (OAuth flow + API integration)

---

#### 2. **Notion** - ✅ CAN BE FIXED
**Solution:** Use official `@notionhq/client` npm package
- **Package:** `npm install @notionhq/client`
- **Auth:** Internal Integration Token (user creates in Notion settings)
- **Capabilities:** Create pages, add content, search, manage databases
- **Example:** `notion.pages.create({ parent: { page_id }, properties: { title } })`
- **Effort:** Low-Medium (simple API, requires user setup)

---

#### 3. **Contacts (macOS)** - ✅ CAN BE FIXED
**Solution:** Use `node-mac-contacts` npm package OR AppleScript
- **Package:** `npm install node-mac-contacts`
- **Auth:** macOS permission prompt (Privacy & Security)
- **Capabilities:** Search contacts by name, get phone/email, create contacts
- **Example:** `contacts.getContactsByName('John')` returns `{ firstName, lastName, phoneNumbers, emailAddresses }`
- **AppleScript Alternative:** `tell application "Contacts" to get value of phones of (first person whose name contains "John")`
- **Effort:** Low (native macOS integration)

---

#### 4. **Slack** - ✅ CAN BE FIXED
**Solution:** Use official `@slack/web-api` npm package
- **Package:** `npm install @slack/web-api`
- **Auth:** Bot Token (user creates Slack App, gets xoxb- token)
- **Capabilities:** Send messages to channels/DMs, read channels
- **Example:** `client.chat.postMessage({ channel: 'general', text: 'Hello!' })`
- **Effort:** Low-Medium (OAuth or webhook setup)

---

#### 5. **Discord** - ✅ CAN BE FIXED
**Solution:** Use `discord.js` npm package
- **Package:** `npm install discord.js`
- **Auth:** Bot Token (user creates Discord App in Developer Portal)
- **Capabilities:** Send messages to channels/DMs, read messages
- **Example:** `channel.send('Hello from Agent Max!')`
- **Effort:** Low-Medium (bot setup required)

---

#### 6. **HubSpot** - ✅ CAN BE FIXED
**Solution:** Use official `@hubspot/api-client` npm package
- **Package:** `npm install @hubspot/api-client`
- **Auth:** Private App Token or OAuth 2.0
- **Capabilities:** Full CRM access - contacts, deals, pipeline, companies
- **Example:** `hubspotClient.crm.deals.basicApi.getPage()` for recent deals
- **Effort:** Medium (OAuth flow + API integration)

---

#### 7. **Zendesk** - ✅ CAN BE FIXED
**Solution:** Use `node-zendesk` npm package
- **Package:** `npm install node-zendesk`
- **Auth:** API Token (generated in Zendesk admin settings)
- **Capabilities:** View tickets, search, check queue, manage conversations
- **Example:** `client.tickets.list({ status: 'open' })`
- **Effort:** Low-Medium (simple token auth)

---

### ⚠️ PARTIALLY SALVAGEABLE (With Caveats)

#### 8. **Signal** - ⚠️ POSSIBLE BUT RISKY
**Solution:** Use `signal-cli` (unofficial command-line tool)
- **Tool:** `brew install signal-cli`
- **Auth:** Requires dedicated phone number + SMS verification
- **Capabilities:** Send/receive messages programmatically
- **Caveats:**
  - Violates Signal ToS (account termination risk)
  - Rate limiting on messages
  - Requires regular updates
  - Complex setup on macOS
- **Recommendation:** Keep "Open Signal" only, remove messaging prompts
- **Effort:** High (complex, risky)

---

#### 9. **ChatGPT/Claude Apps** - ⚠️ NO API FOR DESKTOP APPS
**Issue:** These apps don't expose APIs for external control
- ChatGPT has API but it's separate from the desktop app
- Claude has API but it's separate from the desktop app
- **Recommendation:** Keep "Open [App]" prompts only, remove interaction prompts
- **Alternative:** Could use their web APIs directly instead of controlling the app

---

### 📋 IMPLEMENTATION STATUS (Updated 2026-02-01)

| App | Difficulty | User Value | Status |
|-----|-----------|-----------|--------|
| Contacts | Low | High | ✅ IMPLEMENTED (AppleScript) |
| Notion | Low-Medium | High | ✅ IMPLEMENTED (@notionhq/client) |
| Slack | Low-Medium | High | ✅ IMPLEMENTED (@slack/web-api) |
| Discord | Low-Medium | Medium | ✅ IMPLEMENTED (discord.js) |
| Zendesk | Low-Medium | Medium | ✅ IMPLEMENTED (node-zendesk) |
| HubSpot | Medium | Medium | ✅ IMPLEMENTED (@hubspot/api-client) |
| Salesforce | Medium | Medium | ⏳ Planned (jsforce) |
| Signal | High/Risky | Low | ❌ Skipped (ToS risk) |

---

### 🔧 IMPLEMENTATION COMPLETED

All integrations follow this architecture:
1. **Settings UI** - `src/pages/SettingsEnhanced.jsx` - API token input fields
2. **Secure storage** - `electron/main/main.cjs` - AES-256-GCM encrypted tokens
3. **IPC handlers** - `electron/main/main.cjs` - `integration:*` handlers
4. **Client wrappers** - `electron/integrations/*.cjs` - API client modules
5. **Tool execution** - `electron/autonomous/pullExecutor.cjs` - Tool handlers
6. **Tool aliases** - `electron/autonomous/toolNormalizer.cjs` - Name mapping

### ⚠️ Needs Further Testing:
- Reminders app (AppleScript likely works)
- Google Calendar/Sheets/Docs (user has apps, need to verify Google API integration)
- Third-party task managers (Things, Todoist, OmniFocus - likely have APIs)

## Recommendations

_To be filled in after testing_

---

## Files Referenced
- `src/data/app-capabilities.json` - App prompts database
- `src/components/onboarding/OnboardingFlow.jsx` - Onboarding capability claims
- `src/components/CreateAgentPremium.jsx` - Agent templates
- `src/components/tutorial/tutorialSteps.js` - Tutorial capability claims
