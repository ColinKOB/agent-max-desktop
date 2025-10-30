# Beta Distribution Guide

**Date**: October 30, 2025  
**Status**: Ready for Beta Testing

---

## ✅ Automatic Updates Configuration

### Update System Status: FULLY CONFIGURED

The application now has a complete automatic update system:

#### **Backend (Electron)**
- ✅ `electron-updater` configured
- ✅ GitHub releases as update source
- ✅ Auto-check on startup (5 second delay)
- ✅ Periodic checks every 4 hours
- ✅ User confirmation before download
- ✅ Auto-install on app quit
- ✅ Progress tracking and error handling

#### **Frontend (React)**
- ✅ Update notification component
- ✅ Real-time progress display
- ✅ User-friendly update flow
- ✅ Error handling and retry options

#### **Build Configuration**
- ✅ GitHub publishing configured in `package.json`
- ✅ Cross-platform update support
- ✅ Code signing ready

---

## 📋 Required Variables for Beta Testers

### **Essential Variables (Must Configure)**

Copy `.env.example` to `.env` and configure these:

```bash
# ===========================================
# ESSENTIAL - MUST BE CONFIGURED
# ===========================================

# API URL - Your backend server
VITE_API_URL=https://your-app.up.railway.app

# Environment - Set to production for beta
VITE_ENVIRONMENT=production

# Stripe - Required for payment features
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key

# Supabase - Database (provided)
VITE_SUPABASE_URL=https://rburoajxsyfousnleydw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Optional Variables (Enhanced Features)**

```bash
# Google Integration (Calendar, Drive)
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your_google_api_key

# Error Reporting (Sentry)
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# AI Ambiguity Resolution
VITE_AMBIGUITY_API_KEY=your_ambiguity_api_key
```

### **Feature Flags**

```bash
# Enable/disable features for beta
VITE_ENABLE_PAYMENTS=true
VITE_ENABLE_GOOGLE_INTEGRATION=true
VITE_ENABLE_AMBIGUITY_RESOLUTION=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_ANALYTICS=false

# Beta-specific settings
VITE_BETA_MODE=true
VITE_UPDATE_CHANNEL=beta
```

---

## 🚀 Beta Distribution Process

### **Step 1: Configure Your Environment**

1. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values**:
   - Set your API URL
   - Add your Stripe publishable key
   - Configure optional integrations

### **Step 2: Build for Distribution**

```bash
# Build for all platforms
npm run electron:build

# Or specific platforms
npm run electron:build:mac    # macOS DMG + ZIP
npm run electron:build:win    # Windows NSIS + Portable
npm run electron:build:linux  # Linux AppImage + DEB
```

### **Step 3: Create GitHub Release**

1. **Tag your release**:
   ```bash
   git tag v1.0.0-beta.1
   git push origin v1.0.0-beta.1
   ```

2. **Create GitHub Release**:
   - Go to: https://github.com/ColinKOB/agent-max-desktop/releases
   - Click "Create a new release"
   - Select your tag
   - Add release notes
   - Upload built assets from `release/` folder

### **Step 4: Test Auto-Updates**

1. **Install the beta version**
2. **Make a code change**
3. **Build and release new version**
4. **Verify update notification appears**

---

## 📦 Distribution Files

### **Generated Build Files**

After running `npm run electron:build`, you'll find:

```
release/
├── Agent Max-1.0.0-arm64.dmg          # macOS installer
├── Agent Max-1.0.0-arm64-mac.zip      # macOS portable
├── Agent Max Setup 1.0.0.exe          # Windows installer
├── Agent Max 1.0.0.exe                # Windows portable
├── Agent Max-1.0.0.AppImage           # Linux AppImage
└── Agent Max-1.0.0.deb                # Linux Debian package
```

### **File Sizes (Approximate)**
- macOS DMG: ~120MB
- Windows Installer: ~115MB
- Linux AppImage: ~118MB

---

## 🔧 Beta Tester Instructions

### **What to Send Beta Testers**

1. **Download Link**: GitHub release URL
2. **Installation Guide**: 
   - macOS: Open DMG, drag to Applications
   - Windows: Run installer, follow prompts
   - Linux: Make AppImage executable, run

3. **Configuration Steps**:
   ```bash
   # 1. Install the app
   # 2. Launch Agent Max
   # 3. App will prompt for any missing configuration
   # 4. Enter API keys in settings if needed
   ```

### **First Launch Experience**

1. **App starts** → Checks for updates
2. **User setup** → Profile creation
3. **Feature enablement** → Based on `.env` configuration
4. **Tutorial** → Optional onboarding

---

## 🛠️ Update System Details

### **How Auto-Updates Work**

1. **Check Frequency**: Every 4 hours + on startup
2. **Update Source**: GitHub releases
3. **Download Flow**: User confirmation → Download → Install on quit
4. **UI Notifications**: Real-time progress and status

### **Update Endpoints**

```javascript
// Manual update check
await window.electronAPI.checkForUpdates();

// Listen for update events
window.electronAPI.onUpdateAvailable((info) => {
  // Update available: { version, releaseDate, releaseNotes }
});

window.electronAPI.onUpdateDownloadProgress((progress) => {
  // Download progress: { percent, transferred, total, bytesPerSecond }
});

window.electronAPI.onUpdateDownloaded((info) => {
  // Ready to install: { version }
});
```

### **Update Channels**

```bash
# Configuration for different channels
VITE_UPDATE_CHANNEL=beta    # Beta testers
VITE_UPDATE_CHANNEL=stable  # Production release
VITE_UPDATE_CHANNEL=dev     # Development builds
```

---

## 🔒 Security Considerations

### **Code Signing**

- **macOS**: Configured for hardened runtime
- **Windows**: Ready for certificate signing
- **Linux**: AppImage with proper permissions

### **Environment Security**

- ✅ Sensitive keys in `.env` (not in build)
- ✅ No hardcoded credentials
- ✅ Secure update mechanism (GitHub releases)

### **Network Security**

- ✅ HTTPS-only API calls
- ✅ CORS properly configured
- ✅ Rate limiting enabled

---

## 📊 Monitoring Beta Testing

### **Error Reporting**

If `VITE_SENTRY_DSN` is configured:
- Automatic error capture
- Crash reporting
- Performance monitoring

### **Update Analytics**

Track update adoption:
- Download counts (GitHub)
- Installation success rates
- Update failure reasons

---

## 🚨 Troubleshooting

### **Common Issues**

**Update Not Detected**:
```bash
# Check GitHub release configuration
# Verify version number increment
# Check network connectivity
```

**Download Fails**:
```bash
# Check GitHub release assets
# Verify internet connection
# Check disk space
```

**Installation Fails**:
```bash
# macOS: Check Gatekeeper settings
# Windows: Run as administrator
# Linux: Check file permissions
```

### **Debug Mode**

Enable debug logging:
```bash
VITE_DEBUG_MODE=true
VITE_BETA_MODE=true
```

---

## ✅ Beta Distribution Checklist

### **Pre-Launch**
- [ ] Configure `.env` with production values
- [ ] Test build process on all target platforms
- [ ] Verify code signing certificates
- [ ] Create GitHub release template
- [ ] Test auto-update flow end-to-end

### **Launch**
- [ ] Build release packages
- [ ] Create GitHub release
- [ ] Test installation on clean system
- [ ] Verify update detection works
- [ ] Send to beta testers

### **Post-Launch**
- [ ] Monitor error reports
- [ ] Track update adoption
- [ ] Collect user feedback
- [ ] Prepare bug fix releases

---

## 🎯 Success Metrics

### **Technical Metrics**
- Update success rate: >95%
- Installation success rate: >98%
- Crash rate: <1%
- Update detection time: <30 seconds

### **User Experience**
- Seamless update flow
- Clear progress indicators
- Minimal disruption to work
- Easy rollback if needed

---

## Conclusion

**Agent Max Desktop is fully ready for beta distribution with:**

✅ Complete automatic update system  
✅ Cross-platform build support  
✅ Professional installer packages  
✅ Comprehensive configuration options  
✅ Security best practices  
✅ Monitoring and error reporting  

**Beta testers can download, install, and receive automatic updates just like any commercial desktop application.**

---

*For support during beta testing, refer to the troubleshooting section or check the error logs in the application.*
