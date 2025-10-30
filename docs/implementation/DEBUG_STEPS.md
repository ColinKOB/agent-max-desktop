# Step-by-Step Debug Instructions

Follow these steps **exactly** and share the output with me.

## Step 1: Clean Start (Kill Everything)

```bash
# Kill all running processes
killall node
killall python
killall Electron

# Wait 5 seconds
sleep 5
```

## Step 2: Start Backend (Terminal 1)

Open a new terminal and run:

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Wait** until you see:
```
Application startup complete.
```

**Keep this terminal open** - you'll need to watch it for backend logs.

## Step 3: Start Frontend (Terminal 2)

Open a **second** terminal and run:

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
npm run electron:dev
```

**Wait** until you see both:
```
VITE v5.4.20  ready
Electron app window appears
```

## Step 4: Open DevTools IMMEDIATELY

As soon as the Electron app window appears:

1. **Press `Cmd+Option+I`** (Mac) or `Ctrl+Shift+I` (Windows/Linux)
2. Click the **Console** tab
3. **DO NOT** close DevTools for the rest of this process

## Step 5: Check Initial Logs

In the DevTools Console, you should immediately see:

```
[GoogleConnect] Component loaded - Version 2025-10-27-v3
[GoogleConnect] axios available: true
[GoogleConnect] apiConfigManager available: true
[GoogleConnect] getApiUrl function: function
[GoogleConnect] Resolved API URL on mount: http://127.0.0.1:8000
[GoogleConnect] ✅ Backend health check passed: {...}
```

**If you DON'T see these logs:**
- Take a screenshot of what you DO see
- Share it with me
- STOP here

**If you DO see these logs:**
- Take a screenshot showing the ✅ Backend health check passed
- Continue to Step 6

## Step 6: Navigate to Google Settings

In the Electron app:
1. Click the **Settings icon** (gear icon)
2. Scroll down to find **"Google Services"** section
3. **DO NOT** click the button yet

## Step 7: Click "Sign in with Google" Button

1. **Keep DevTools visible** next to the app window
2. Click **"Sign in with Google"** button
3. **Watch DevTools Console** carefully

## Step 8: Capture the Logs

### In DevTools Console, copy ALL lines that start with:
- `[GoogleConnect]`
- Any red error messages

### In Backend Terminal (Terminal 1), copy ALL lines that contain:
- `[Google OAuth]`
- `/api/v2/google/auth/url`
- Any error messages

## Step 9: Share With Me

Send me:

1. **Screenshot of DevTools Console** showing:
   - The initial health check (Step 5)
   - The logs after clicking the button (Step 7)

2. **Text** copy-pasted from DevTools Console with ALL `[GoogleConnect]` logs

3. **Text** copy-pasted from Backend Terminal with ALL `[Google OAuth]` logs

4. **What you see on screen**: Does the Google auth page open in a browser?

## Expected Success Flow

If everything works, you should see:

### DevTools Console:
```
[GoogleConnect] =================================
[GoogleConnect] Connect button clicked
[GoogleConnect] API_URL: http://127.0.0.1:8000
[GoogleConnect] Fetching auth URL from: http://127.0.0.1:8000/api/v2/google/auth/url
[GoogleConnect] Auth URL response: { auth_url: "https://accounts.google.com...", ... }
[GoogleConnect] Calling window.electronAPI.openExternal...
[GoogleConnect] openExternal result: { success: true }
```

### Backend Terminal:
```
==========================================
[Google OAuth] /auth/url endpoint called
[Google OAuth] CLIENT_ID configured: True
[Google OAuth] ✅ Created OAuth auth URL
==========================================
```

### And:
- A browser window opens with Google's OAuth page
- The button shows "Waiting for authorization..."

## If It Fails

Look for:

### "Network Error" in logs:
```
[GoogleConnect] ❌ Connection failed: Network Error
```
This means axios can't reach the backend.

### Backend never receives the request:
If you click the button but the backend terminal shows NO new logs, the request isn't reaching the backend.

### openExternal fails:
```
[GoogleConnect] openExternal result: { success: false, error: "..." }
```
This means Electron can't open the browser.

---

**Do these steps and share the logs with me.** With the version stamp and health check, we'll see exactly what's happening!
