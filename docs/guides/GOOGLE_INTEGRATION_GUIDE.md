# Google Services Integration Guide

## ✅ Setup Complete!

Agent Max now has a **full Google integration** in the Settings UI with enhanced functionality:

---

## 🎯 Features

### What's Available

**Integrated Services:**
- ✅ **Gmail** - Read and send emails
- ✅ **Calendar** - Manage events and meetings  
- ✅ **Docs** - Create and read documents
- ✅ **Sheets** - Work with spreadsheets
- ✅ **YouTube** - Search and manage videos

### UI Features:
1. **OAuth 2.0 Connection** - Secure authentication via browser
2. **Service Testing** - Test each service individually with one click
3. **Visual Status** - See which services are working (✓), have errors (⚠️), or are untested (🧪)
4. **Connection Management** - Easy connect/disconnect controls
5. **Dark Mode Support** - Beautiful UI in both themes

---

## 🚀 How to Set Up

### Backend Setup (Required)

#### 1. Get Google OAuth Credentials

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing

2. **Enable APIs:**
   ```
   Navigation: APIs & Services → Library
   
   Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Docs API
   - Google Sheets API
   - YouTube Data API v3
   ```

3. **Create OAuth 2.0 Client:**
   ```
   Navigation: APIs & Services → Credentials → Create Credentials → OAuth client ID
   
   Application type: Desktop app
   Name: Agent Max
   
   Download the JSON file
   ```

4. **Extract Credentials:**
   ```json
   {
     "installed": {
       "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
       "client_secret": "YOUR_CLIENT_SECRET",
       "...": "..."
     }
   }
   ```

#### 2. Configure Backend

**Add to `.env` file:**
```bash
# Agent_Max/.env
GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

**Or export as environment variables:**
```bash
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
```

#### 3. Restart Backend API
```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/Agent_Max
pkill -f "agent_max.py --api"
./venv/bin/python agent_max.py --api
```

---

## 📱 Frontend Usage

### 1. Open Settings

```
Launch Agent Max → Settings → Google Services section
```

### 2. Connect Account

1. Click **"Connect Google Account"**
2. Browser opens with Google login
3. Grant permissions to Agent Max
4. Return to app - you're connected! ✅

### 3. Test Services

Once connected, each service has a **test button** (🧪):

```
Click test button → Tests that specific service
Results:
  ✓ Green checkmark = Working
  ⚠️ Red alert = Error
  🧪 Test tube = Not tested yet
```

**What Each Test Does:**

- **Gmail:** Fetches 1 recent email
- **Calendar:** Fetches 1 upcoming event
- **Sheets:** Verifies access
- **Docs:** Verifies access
- **YouTube:** Searches for "test" video

### 4. Disconnect

Click **"Disconnect Google Account"** to revoke access.

---

## 🛠️ Technical Details

### Architecture

```
┌─────────────────────────────────────────┐
│         Desktop App (Electron)          │
│  src/components/GoogleConnect.jsx       │
└─────────────────────────────────────────┘
                    │
                    │ HTTP Requests
                    ▼
┌─────────────────────────────────────────┐
│         Backend API (FastAPI)           │
│  Agent_Max/api/routers/google.py        │
└─────────────────────────────────────────┘
                    │
                    │ OAuth 2.0 + API Calls
                    ▼
┌─────────────────────────────────────────┐
│         Google Services                 │
│  Gmail, Calendar, Docs, Sheets, YouTube │
└─────────────────────────────────────────┘
```

### Backend Endpoints

**Available at:** `http://localhost:8000/api/v2/google/`

#### Authentication
```
GET  /auth/url          - Get OAuth authorization URL
GET  /auth/callback     - OAuth callback handler
GET  /status            - Check connection status
POST /disconnect        - Disconnect account
```

#### Gmail
```
GET  /gmail/recent      - Get recent emails
POST /gmail/send        - Send email
POST /gmail/draft       - Create draft
GET  /gmail/search      - Search emails
```

#### Calendar
```
GET  /calendar/events   - Get upcoming events
POST /calendar/create   - Create event
PUT  /calendar/update   - Update event
DELETE /calendar/delete - Delete event
```

#### Sheets
```
GET  /sheets/read       - Read spreadsheet data
POST /sheets/write      - Write to spreadsheet
POST /sheets/create     - Create new spreadsheet
```

#### Docs
```
GET  /docs/read         - Read document
POST /docs/create       - Create document
POST /docs/append       - Append to document
```

#### YouTube
```
GET  /youtube/search    - Search videos
GET  /youtube/playlists - Get playlists
POST /youtube/upload    - Upload video
```

### Frontend API Calls

**Example: Test Gmail**
```javascript
const result = await axios.get(`${API_URL}/api/v2/google/gmail/recent`, {
  params: { 
    email: userEmail, 
    max_results: 1 
  }
});

if (result.data.emails?.length > 0) {
  toast.success('Gmail works!');
}
```

### Token Storage

**Backend:**
```
Location: Agent_Max/state/google_tokens/
Format: {email}_tokens.json

Contains:
- access_token (short-lived)
- refresh_token (long-lived)
- expires_at (timestamp)
```

**Frontend:**
```
Location: localStorage
Key: google_user_email
Value: "user@gmail.com"
```

---

## 🔒 Security

### OAuth 2.0 Flow (PKCE)

1. **User clicks connect**
2. **App generates:** `code_verifier` and `code_challenge`
3. **User authorizes** in browser
4. **Google redirects** with auth code
5. **App exchanges** code for tokens
6. **Tokens stored** securely on server

### Token Refresh

- Access tokens expire after 1 hour
- Backend automatically refreshes using refresh token
- User never needs to re-authenticate
- Refresh tokens are stored securely

### Scopes Requested

```
gmail.readonly         - Read Gmail emails
gmail.send             - Send emails
calendar               - Full calendar access
docs                   - Full Docs access
spreadsheets           - Full Sheets access
youtube.readonly       - Read YouTube data
youtube.force-ssl      - YouTube uploads
```

---

## 🧪 Testing

### Manual Testing

**Test Connection:**
```bash
# 1. Start backend
cd Agent_Max
./venv/bin/python agent_max.py --api

# 2. Test auth URL
curl http://localhost:8000/api/v2/google/auth/url

# 3. Connect via UI
# Click "Connect Google Account" in Settings

# 4. Test services
# Click test button for each service
```

### Automated Testing

```bash
# Run backend tests
cd Agent_Max
pytest tests/test_google_integration.py

# Test specific service
pytest tests/test_google_integration.py::test_gmail_recent
```

---

## 🐛 Troubleshooting

### "Failed to start Google authentication"

**Cause:** Missing or invalid OAuth credentials

**Fix:**
```bash
# Check environment variables
echo $GOOGLE_OAUTH_CLIENT_ID
echo $GOOGLE_OAUTH_CLIENT_SECRET

# If empty, add to .env file
nano Agent_Max/.env

# Restart API
pkill -f "agent_max.py --api"
./venv/bin/python agent_max.py --api
```

### "Gmail test failed"

**Cause:** API not enabled or wrong scope

**Fix:**
1. Go to Google Cloud Console
2. Enable Gmail API
3. Disconnect and reconnect in UI
4. Test again

### "Token expired" errors

**Cause:** Refresh token invalid

**Fix:**
```bash
# Clear stored tokens
rm Agent_Max/state/google_tokens/*

# Reconnect in UI
```

### Connection loops forever

**Cause:** OAuth callback not completing

**Fix:**
1. Check browser console for errors
2. Ensure redirect URI matches Google Console
3. Try different browser

---

## 📊 Usage Examples

### Example 1: Read Recent Emails

```javascript
// In your code
const emails = await axios.get(`${API_URL}/api/v2/google/gmail/recent`, {
  params: { 
    email: 'user@gmail.com', 
    max_results: 10 
  }
});

console.log(emails.data.emails);
```

### Example 2: Send Email

```javascript
await axios.post(`${API_URL}/api/v2/google/gmail/send`, {
  email: 'user@gmail.com',
  to: 'recipient@example.com',
  subject: 'Hello from Agent Max',
  body: 'This is a test email!'
});
```

### Example 3: Create Calendar Event

```javascript
await axios.post(`${API_URL}/api/v2/google/calendar/create`, {
  email: 'user@gmail.com',
  summary: 'Team Meeting',
  start: '2025-10-15T14:00:00-04:00',
  end: '2025-10-15T15:00:00-04:00'
});
```

### Example 4: Search YouTube

```javascript
const results = await axios.get(`${API_URL}/api/v2/google/youtube/search`, {
  params: { 
    email: 'user@gmail.com', 
    query: 'python tutorial',
    max_results: 5
  }
});

console.log(results.data.videos);
```

---

## 🎨 UI Components

### GoogleConnect Component

**Location:** `src/components/GoogleConnect.jsx`

**Features:**
- Connection status checking
- OAuth flow management
- Service testing
- Status indicators
- Dark mode support

**Props:** None (self-contained)

**State:**
```javascript
- connected: boolean
- userEmail: string
- loading: boolean
- error: string
- scopes: string[]
- testingService: string | null
- serviceStatus: { [service]: 'working' | 'error' }
```

### Integration in Settings

**Location:** `src/pages/Settings.jsx`

```jsx
import { GoogleConnect } from '../components/GoogleConnect';

// In Settings page:
<div className="card mb-6">
  <div className="flex items-center space-x-2 mb-4">
    <Globe className="w-5 h-5 text-blue-600" />
    <h2 className="text-xl font-bold">Google Services</h2>
  </div>
  <GoogleConnect />
</div>
```

---

## 🔄 Update Process

### Frontend Changes

```bash
# Edit GoogleConnect.jsx
# Changes are hot-reloaded automatically
# No restart needed
```

### Backend Changes

```bash
# Edit google.py
cd Agent_Max
pkill -f "agent_max.py --api"
./venv/bin/python agent_max.py --api
```

### Adding New Service

1. **Add endpoint to `google.py`:**
```python
@router.get("/newservice/action")
async def new_service_action(email: str = Query(...)):
    client = await get_gmail_client(email)
    # Your logic here
```

2. **Add to services array in `GoogleConnect.jsx`:**
```javascript
{ 
  name: 'NewService', 
  icon: IconName, 
  description: 'Service description' 
}
```

3. **Add test case:**
```javascript
case 'NewService':
  result = await axios.get(`${API_URL}/api/v2/google/newservice/action`, {
    params: { email: userEmail }
  });
  toast.success('NewService works!');
  break;
```

---

## 📝 Summary

✅ **Google integration is live in Settings**
✅ **5 services:** Gmail, Calendar, Docs, Sheets, YouTube
✅ **OAuth 2.0** with PKCE for security
✅ **Service testing** with visual indicators
✅ **Beautiful UI** with dark mode support
✅ **Auto token refresh** handled by backend
✅ **Easy connect/disconnect** workflow

### Quick Start:

1. Add OAuth credentials to backend `.env`
2. Restart backend API
3. Open Settings → Google Services
4. Click "Connect Google Account"
5. Test each service
6. Start using Google features in Agent Max! 🚀

**The Google integration is production-ready!** 🎉
