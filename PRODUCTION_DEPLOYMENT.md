# 🚀 Production Deployment Guide - Agent Max Desktop

Complete guide to deploy the Agent Max Desktop app and connect to production backend.

---

## 📋 **Overview**

### **Architecture:**
```
┌─────────────────────┐
│ User's Computer     │
│                     │
│  ┌───────────────┐  │
│  │ Agent Max.app │  │  Electron Desktop App
│  │ (Standalone)  │  │
│  └───────┬───────┘  │
└──────────┼──────────┘
           │ HTTPS
           ▼
┌─────────────────────┐
│ Railway/Render      │
│                     │
│ Agent Max API       │
│ (FastAPI Backend)   │
└─────────────────────┘
```

---

## 🎯 **Step-by-Step Deployment**

### **Phase 1: Deploy Backend** ✅ COMPLETED

See `RAILWAY_DEPLOYMENT.md` in Agent_Max folder.

**Your backend should now be live at:**
```
https://YOUR-APP.up.railway.app
```

---

### **Phase 2: Configure Frontend for Production**

#### **Step 1: Create Production .env**

```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop

# Create .env file
cat > .env << 'EOF'
VITE_API_URL=https://YOUR-APP.up.railway.app
VITE_ENVIRONMENT=production
EOF
```

Replace `YOUR-APP.up.railway.app` with your actual Railway URL.

#### **Step 2: Test Connection**

```bash
# Start dev server with production API
npm run dev

# Open browser
open http://localhost:5173
```

**Test:**
1. Open FloatBar
2. Send message: "Hello"
3. Should connect to Railway backend
4. Check browser console for any CORS errors

#### **Step 3: Fix Any CORS Issues**

If you see CORS errors:

**Backend (`Agent_Max/api/config.py`):**
```python
# Ensure ENVIRONMENT=production in Railway
# Add your custom domain if needed
```

**Railway variables:**
```bash
railway variables set ENVIRONMENT=production
railway variables set FRONTEND_URL=https://app.agentmax.com  # If using custom domain
```

---

### **Phase 3: Build Production Electron App**

#### **Step 1: Clean Build**

```bash
cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop

# Clean previous builds
rm -rf dist dist-electron release

# Install dependencies
npm install
```

#### **Step 2: Build for macOS**

```bash
# Build .dmg and .zip
npm run electron:build:mac
```

**Output:**
```
release/
├── Agent Max-1.0.0.dmg         # Installer
├── Agent Max-1.0.0-mac.zip     # Portable version
└── mac-arm64/                   # App bundle
    └── Agent Max.app
```

#### **Step 3: Build for Windows** (Optional - if on Mac with Wine)

```bash
npm run electron:build:win
```

#### **Step 4: Build for Linux** (Optional)

```bash
npm run electron:build:linux
```

---

### **Phase 4: Code Signing** (Optional but Recommended)

#### **macOS Code Signing:**

**Why?**
- Prevents "App from unidentified developer" warning
- Required for distribution outside App Store

**How:**

1. **Get Apple Developer Account:** https://developer.apple.com ($99/year)

2. **Create certificates:**
   ```bash
   # In Xcode → Preferences → Accounts
   # Download "Developer ID Application" certificate
   ```

3. **Sign the app:**
   ```bash
   codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" "release/mac-arm64/Agent Max.app"
   ```

4. **Notarize:**
   ```bash
   # Required for macOS 10.15+
   xcrun notarytool submit "release/Agent Max-1.0.0.dmg" --apple-id "your@email.com" --password "app-specific-password" --team-id "TEAM_ID"
   ```

---

### **Phase 5: Distribution**

#### **Option 1: Direct Download**

**Host on:**
- GitHub Releases
- Your own website
- AWS S3 + CloudFront

**GitHub Releases:**
```bash
# Create release
gh release create v1.0.0 \
  release/Agent\ Max-1.0.0.dmg \
  release/Agent\ Max-1.0.0-mac.zip \
  --title "Agent Max v1.0.0" \
  --notes "Initial release"
```

#### **Option 2: Mac App Store**

1. Create App Store Connect account
2. Prepare app for submission
3. Submit for review
4. Wait for approval (1-7 days)

#### **Option 3: Auto-Updater** (Advanced)

Use `electron-updater`:

**In `electron/main.cjs`:**
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

**In `package.json`:**
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_USERNAME",
      "repo": "agent-max-desktop"
    }
  }
}
```

---

## 🔧 **Production Configuration**

### **Electron App Settings**

**Backend URL:**
- Hardcoded in `.env` file
- Bundled with app
- Users can't change (more secure)

**Memory Storage:**
```
~/Library/Application Support/agent-max-desktop/
├── memories/
│   ├── profile.json
│   ├── facts.json
│   ├── conversations.json
│   └── preferences.json
```

**Logs:**
```
~/Library/Logs/agent-max-desktop/
└── main.log
```

---

## 🧪 **Testing Checklist**

### **Pre-Release Testing:**

- [ ] Backend deployed and accessible
- [ ] Frontend connects to production API
- [ ] Authentication works (if enabled)
- [ ] All features work:
  - [ ] Send messages
  - [ ] Conversation memory
  - [ ] Screenshot upload
  - [ ] Profile display
- [ ] Error handling works
- [ ] No console errors
- [ ] Production build runs on clean machine
- [ ] Installer works (.dmg mounts and installs)

### **Security Testing:**

- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] No API keys in frontend code
- [ ] Secure credential storage
- [ ] No debug logs in production

---

## 📊 **Monitoring Production**

### **Backend Monitoring:**

**Railway Dashboard:**
- CPU/Memory usage
- Request count
- Error rate
- Logs

**Set up alerts:**
```bash
# In Railway dashboard
Settings → Alerts
- CPU > 80%
- Memory > 80%
- Errors > 10/minute
```

### **Frontend Monitoring:**

**Error Tracking (Optional):**

Install Sentry:
```bash
npm install @sentry/electron
```

**In `electron/main.cjs`:**
```javascript
const Sentry = require('@sentry/electron');

Sentry.init({ dsn: 'YOUR_SENTRY_DSN' });
```

---

## 💰 **Cost Estimation**

### **Backend (Railway):**
- **Free Tier:** $5 credits/month
- **Starter:** $5/month + usage
- **Est. Usage:** $10-15/month for moderate use

### **Frontend (Hosted):**
- **GitHub Releases:** Free
- **Custom website:** $5-10/month
- **CDN (CloudFront):** ~$1/month

### **Code Signing:**
- **Apple Developer:** $99/year (optional)
- **Windows Code Signing:** $100-200/year (optional)

### **Total Est.:**
- **Minimum:** $10-15/month (Railway only)
- **With signing:** $15-20/month + $99-199/year

---

## 🚀 **Quick Start for Users**

### **Installation Instructions (for your users):**

**macOS:**
1. Download `Agent Max-1.0.0.dmg`
2. Open the .dmg file
3. Drag "Agent Max" to Applications
4. Open from Applications folder
5. If "unidentified developer" warning:
   - Right-click → Open
   - Click "Open" in dialog

**Windows:**
1. Download `Agent Max Setup 1.0.0.exe`
2. Run the installer
3. Follow installation wizard
4. Launch from Start Menu

**First Use:**
1. App opens with floating bar
2. Type a message to test
3. Profile auto-creates
4. Start chatting!

---

## 🐛 **Troubleshooting Production**

### **Issue: "Cannot connect to server"**

**Check:**
1. Railway backend is running
2. Frontend has correct API URL in `.env`
3. No CORS errors in console
4. Railway hasn't run out of credits

**Fix:**
```bash
# Check Railway status
railway status

# View logs
railway logs

# Restart service
railway up
```

### **Issue: "App won't open on macOS"**

**Cause:** App not signed

**Fix for users:**
```bash
# Remove quarantine flag
xattr -d com.apple.quarantine "/Applications/Agent Max.app"
```

**Long-term fix:** Code sign the app

### **Issue: "Features not working"**

**Check:**
1. Backend API version matches frontend
2. All environment variables set
3. OpenAI API key valid and has credits

---

## 📝 **Update/Release Workflow**

### **For New Releases:**

1. **Update Version:**
   ```json
   // package.json
   {
     "version": "1.0.1"
   }
   ```

2. **Update Changelog:**
   ```markdown
   ## v1.0.1 (2025-10-15)
   - Fixed: Connection timeout issues
   - Added: Better error messages
   ```

3. **Build:**
   ```bash
   npm run electron:build:mac
   ```

4. **Test:**
   - Install fresh
   - Test all features
   - Check on clean machine

5. **Release:**
   ```bash
   gh release create v1.0.1 \
     release/Agent\ Max-1.0.1.dmg \
     --title "v1.0.1 - Bug Fixes" \
     --notes-file CHANGELOG.md
   ```

6. **Notify Users:**
   - Email
   - In-app notification (if auto-updater enabled)
   - Social media

---

## ✅ **Production Deployment Checklist**

### **Backend:**
- [ ] Deployed to Railway
- [ ] Environment variables set
- [ ] HTTPS working
- [ ] CORS configured
- [ ] Health check passes
- [ ] Logs monitored

### **Frontend:**
- [ ] Production API URL configured
- [ ] Build succeeds
- [ ] .dmg created
- [ ] App opens and runs
- [ ] Connects to backend
- [ ] Features work
- [ ] No errors in console

### **Distribution:**
- [ ] Installer tested
- [ ] Code signed (optional)
- [ ] Release notes written
- [ ] Download links ready
- [ ] User documentation created

---

## 🎉 **You're Live!**

Your Agent Max system is now in production:

- ✅ Backend running on Railway
- ✅ Frontend built and ready to distribute
- ✅ Users can download and install
- ✅ Everything connected and working

**Next:** Monitor usage, gather feedback, iterate!

---

## 🔗 **Useful Resources**

- **Railway Docs:** https://docs.railway.app
- **Electron Builder Docs:** https://www.electron.build
- **Code Signing Guide:** https://www.electron.build/code-signing
- **Auto-Updater:** https://www.electron.build/auto-update

---

**Need Help?** Check the troubleshooting section or open an issue on GitHub.

Good luck with your launch! 🚀
