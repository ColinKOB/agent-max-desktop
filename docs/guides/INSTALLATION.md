# Installation & Setup Guide

Complete guide to install and run Agent Max Desktop.

## 📋 System Requirements

- **Operating System:** macOS, Windows, or Linux
- **Node.js:** Version 18.0 or higher
- **RAM:** 4GB minimum
- **Disk Space:** 500MB for dependencies

## 🔧 Step-by-Step Installation

### 1. Verify Node.js Installation

```bash
node --version
```

Should show `v18.0.0` or higher. If not installed, download from [nodejs.org](https://nodejs.org/).

### 2. Navigate to Project Directory

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
```

### 3. Install Dependencies

```bash
npm install
```

**Expected output:**
```
added 500+ packages in 2-3 minutes
```

**Packages installed:**
- Electron 28
- React 18
- Vite 5
- TailwindCSS 3
- Zustand (state management)
- Axios (HTTP client)
- Lucide React (icons)
- React Hot Toast (notifications)
- date-fns (date utilities)

### 4. Start the Agent Max API

**In a separate terminal:**

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
python agent_max.py --api
```

**Verify API is running:**
```bash
curl http://localhost:8000/health
```

Should return: `{"status":"healthy"}`

### 5. Start the Desktop App

**Back in the agent-max-desktop directory:**

```bash
npm run electron:dev
```

**What happens:**
1. Vite dev server starts on `http://localhost:5173`
2. Electron window opens automatically
3. App loads with hot reload enabled
4. DevTools open automatically (development mode)

## ✅ Verify Installation

### Check 1: App Window Opens
- Electron window should appear
- Sidebar visible on the left
- Dashboard page loads

### Check 2: API Connection
- Look for green dot next to profile in sidebar
- If red, go to Settings → Test Connection

### Check 3: Navigation Works
- Click through all 6 pages:
  - Dashboard
  - Conversation
  - Knowledge
  - Search
  - Preferences
  - Settings

### Check 4: Theme Toggle
- Go to Settings
- Toggle between Light/Dark mode
- UI should update immediately

## 🎨 Development Mode Features

When running with `npm run electron:dev`:

- **Hot Reload** - Changes to React code reload instantly
- **DevTools** - Browser DevTools open by default
- **Console Logs** - See API requests and errors
- **React DevTools** - Inspect component tree

## 🏗️ Building for Production

### Build the App

```bash
npm run electron:build
```

**Build process:**
1. Vite builds optimized React bundle
2. Electron Builder packages the app
3. Creates platform-specific installers

**Output location:** `dist-electron/`

### Platform-Specific Builds

**macOS:**
```bash
npm run electron:build
# Creates: dist-electron/Agent Max-1.0.0.dmg
#          dist-electron/Agent Max-1.0.0-mac.zip
```

**Windows:**
```bash
npm run electron:build
# Creates: dist-electron/Agent Max Setup 1.0.0.exe
#          dist-electron/Agent Max 1.0.0.exe (portable)
```

**Linux:**
```bash
npm run electron:build
# Creates: dist-electron/Agent Max-1.0.0.AppImage
#          dist-electron/agent-max_1.0.0_amd64.deb
```

## 🔄 Update Dependencies

To update all packages to latest versions:

```bash
npm update
```

To update specific package:

```bash
npm update electron
npm update react
```

## 🧹 Clean Installation

If you encounter issues, try a clean install:

```bash
# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

## 🐛 Troubleshooting Installation

### Issue: "npm: command not found"

**Solution:** Install Node.js from [nodejs.org](https://nodejs.org/)

### Issue: "EACCES: permission denied"

**Solution:**
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Issue: "gyp ERR! stack Error: not found: python"

**Solution:** Install Python:
```bash
# macOS
brew install python

# Ubuntu/Debian
sudo apt-get install python3
```

### Issue: Build fails on macOS

**Solution:** Install Xcode Command Line Tools:
```bash
xcode-select --install
```

### Issue: "Port 5173 already in use"

**Solution:**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
PORT=5174 npm run dev
```

### Issue: Electron window doesn't open

**Solution:**
```bash
# Check if Vite server started
curl http://localhost:5173

# Check Electron logs in terminal
# Look for errors in console output
```

## 📦 Package Sizes

**Development:**
- `node_modules/`: ~500MB
- Total project: ~520MB

**Production Build:**
- macOS DMG: ~150MB
- Windows installer: ~120MB
- Linux AppImage: ~130MB

## 🔐 Security Notes

### API Key Storage
- API keys stored in localStorage
- Not encrypted (local development only)
- For production, use secure credential storage

### CORS Configuration
- API must allow `http://localhost:5173` in development
- Production builds use file:// protocol

## 🚀 Performance Tips

### Development
- Close unused apps to free RAM
- Use `npm run dev` (Vite only) for faster startup
- Disable DevTools if not needed

### Production
- Built app uses ~100MB RAM
- Startup time: 1-2 seconds
- API calls cached for performance

## 📝 Environment Variables

Create `.env` file for custom configuration:

```env
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-api-key-here

# Development
VITE_DEV_PORT=5173
```

## 🎯 Next Steps

After successful installation:

1. Read [QUICKSTART.md](QUICKSTART.md) for first-time usage
2. Read [README.md](README.md) for full documentation
3. Check API docs at http://localhost:8000/docs
4. Start using the app!

## 💬 Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Check terminal output for errors
3. Check DevTools console (Cmd+Option+I)
4. Verify API is running and accessible
5. Try clean installation

---

**Installation complete! Ready to use Agent Max Desktop. 🎉**
