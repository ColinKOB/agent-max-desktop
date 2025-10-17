# 🚀 Build & Distribution Guide - Agent Max Desktop

## ✅ **What's Been Set Up**

### **1. Auto-Dependency Installation**
- `postinstall` script in `package.json` runs automatically
- All dependencies install when user downloads the app
- No terminal interaction needed for end users

### **2. Welcome Screen / Onboarding**
- Beautiful multi-step welcome screen
- Collects smart user information:
  - **Name** - Personalizes the experience
  - **Role** - Developer, Designer, Student, etc.
  - **Primary Use** - Coding, Automation, Research, etc.
  - **Work Style** - Detailed, Concise, Interactive, Autonomous
  - **Timezone** - Auto-detected
- All data saved to local encrypted memory
- Only shows on first launch
- Window automatically resizes after onboarding

### **3. Build Configuration**
- Cross-platform build support (macOS, Windows, Linux)
- Proper code signing for macOS
- Installers for all platforms
- No OpenAI API key needed from users (you provide it on backend)

---

## 📦 **Building the App**

### **Prerequisites:**
```bash
# Install dependencies (one-time)
npm install
```

### **Build for macOS:**
```bash
npm run electron:build:mac
```
**Output:** `release/Agent Max-1.0.0.dmg` and `.zip`

### **Build for Windows:**
```bash
npm run electron:build:win
```
**Output:** `release/Agent Max Setup 1.0.0.exe`

### **Build for Linux:**
```bash
npm run electron:build:linux
```
**Output:** `release/Agent Max-1.0.0.AppImage`, `.deb`, `.rpm`

### **Build for All Platforms:**
```bash
npm run electron:build
```

---

## 📤 **Distribution Flow**

### **What Happens When User Downloads:**

1. **User downloads `.dmg` / `.exe` / `.AppImage`**
2. **User installs the app** (drag to Applications / run installer)
3. **User launches Agent Max**
4. **App automatically:**
   - Creates memory directory
   - Initializes encryption
   - Shows welcome screen
5. **User completes onboarding** (30 seconds)
6. **App transitions to FloatBar mode**
7. **User can start chatting immediately!**

**No terminal needed! No API key needed! No configuration!**

---

## 🔐 **API Key Management**

### **Current Setup (Perfect for MVP):**

- **Backend API** (Agent Max server) has OpenAI API key
- **Desktop app** connects to your backend
- **You pay for all tokens** (centralized billing)
- **Users never see or need API key**

### **API Configuration:**

In `src/services/api.js`:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

**For production:**
```bash
# Create .env file
VITE_API_URL=https://api.agentmax.app
```

---

## 💰 **Monetization Setup (Future)**

### **When Ready to Monetize:**

**Option 1: Subscription Model**
```javascript
// Add to welcome screen or settings
- Free tier: 100 requests/month
- Pro tier: $10/month unlimited
- Enterprise tier: $50/month + priority support
```

**Option 2: Usage-Based**
```javascript
// Track on backend
- Pay as you go: $0.10 per request
- Packages: 100 requests for $5
```

**Option 3: Freemium**
```javascript
// Basic features free, premium features paid
- Free: Simple questions, basic commands
- Pro: Advanced automation, integrations
```

### **Implementation:**

1. **Add authentication to backend**
2. **Add subscription management** (Stripe)
3. **Track usage per user**
4. **Add billing UI to app**
5. **Implement usage limits**

---

## 🎯 **User Onboarding Flow**

### **Step 1: Name**
- Input field
- Required to proceed
- Saved to `profile.name`

### **Step 2: Role**
- 8 options (Developer, Designer, Manager, etc.)
- Helps AI understand context
- Saved to `preferences.role`

### **Step 3: Primary Use**
- 6 options (Coding, Automation, etc.)
- Helps AI prioritize features
- Saved to `preferences.primary_use`

### **Step 4: Work Style**
- 4 options (Detailed, Concise, etc.)
- Helps AI adjust communication
- Saved to `preferences.work_style`

### **Smart Data Collection:**

All collected data helps the AI:
- **Name** → Personalized greetings
- **Role** → Context-aware suggestions
- **Primary Use** → Relevant examples
- **Work Style** → Response formatting
- **Timezone** → Time-aware responses

---

## 🔧 **Technical Details**

### **Window Management:**

**Welcome Screen Mode:**
- 800x600 px
- Centered
- Full UI visible
- Not always on top

**FloatBar Mode:**
- 360x80 px (collapsed)
- Top-right corner
- Always on top
- Expandable to 360x520 px

**Transition:**
- Automatic after onboarding
- Smooth resize
- Position change
- Mode switch

### **Memory Storage:**

**Location:**
- macOS: `~/Library/Application Support/agent-max-desktop/memories/`
- Windows: `%APPDATA%/agent-max-desktop/memories/`
- Linux: `~/.config/agent-max-desktop/memories/`

**Files:**
- `profile.json` (encrypted)
- `facts.json` (encrypted)
- `conversations.json` (encrypted)
- `preferences.json` (encrypted)

### **Encryption:**

- AES-256-CBC encryption
- Machine-specific keys
- Auto-generated on first run
- Secure and local

---

## 📋 **Pre-Distribution Checklist**

### **Before Building:**

- [ ] Update version in `package.json`
- [ ] Set production API URL in `.env`
- [ ] Test on target platform
- [ ] Test welcome screen flow
- [ ] Test FloatBar functionality
- [ ] Test memory persistence
- [ ] Test API connectivity
- [ ] Verify encryption works

### **Before Releasing:**

- [ ] Code signing certificate (macOS)
- [ ] Notarization (macOS)
- [ ] Windows certificate (optional but recommended)
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Update check mechanism (optional)
- [ ] Analytics (optional)
- [ ] Error reporting (optional)

---

## 🚀 **Quick Release Steps**

### **1. Prepare:**
```bash
# Update version
npm version 1.0.0

# Set production API
echo "VITE_API_URL=https://api.agentmax.app" > .env

# Install dependencies
npm install
```

### **2. Build:**
```bash
# Build for your platform
npm run electron:build:mac

# Output in release/ folder
```

### **3. Test:**
```bash
# Install the built app
open release/Agent\ Max-1.0.0.dmg

# Test complete flow:
# - Install
# - Launch
# - Welcome screen
# - Onboarding
# - FloatBar
# - Send message
# - Restart (verify memory)
```

### **4. Distribute:**
```bash
# Upload to your hosting
# - GitHub Releases
# - Your website
# - App stores (future)
```

---

## 🌟 **User Instructions (For Your Website)**

### **Simple 3-Step Process:**

**1. Download Agent Max**
- Download for macOS / Windows / Linux
- No account needed
- No API key needed

**2. Install & Launch**
- Open the downloaded file
- Install like any other app
- Launch Agent Max

**3. Complete Welcome Screen**
- Enter your name
- Select your role
- Choose your use case
- Pick your work style
- Done! Start chatting!

**That's it!** No terminal, no configuration, no hassle!

---

## 🎉 **What Makes This Great**

### **For Users:**
✅ **No Technical Knowledge** - Just download and go  
✅ **No API Key** - You handle that  
✅ **Beautiful UI** - Professional and modern  
✅ **Smart AI** - Learns from onboarding  
✅ **Private** - All data local and encrypted  
✅ **Fast** - Native desktop performance

### **For You (Developer):**
✅ **Centralized API** - Control costs and usage  
✅ **Easy Updates** - Update backend anytime  
✅ **Analytics** - Track usage on your server  
✅ **Monetization Ready** - Add billing anytime  
✅ **Professional** - Production-ready setup

---

## 📊 **Monetization Timeline (Example)**

### **Phase 1: Free Beta (Months 1-3)**
- Free for all users
- Collect feedback
- Improve features
- Build user base

### **Phase 2: Freemium (Months 4-6)**
- Free tier: 100 requests/month
- Pro tier: $10/month unlimited
- Grandfather early users

### **Phase 3: Full Launch (Month 7+)**
- Paid tiers active
- App store distribution
- Marketing campaign
- Revenue flowing!

---

## 🔮 **Future Enhancements**

### **Auto-Updates:**
```javascript
// electron-builder supports auto-updates
"autoUpdater": {
  "provider": "github",
  "repo": "agent-max-desktop"
}
```

### **Usage Analytics:**
```javascript
// Track feature usage (privacy-friendly)
- Most used commands
- Average session length
- Feature adoption
```

### **Cloud Sync (Optional):**
```javascript
// Sync memories across devices
- Encrypted cloud storage
- Multiple device support
- Backup & restore
```

---

## ✅ **You're Ready!**

**Current Status:**
- ✅ Auto-dependency installation
- ✅ Beautiful welcome screen
- ✅ Smart user onboarding
- ✅ Window mode switching
- ✅ Build configuration
- ✅ Cross-platform support
- ✅ No API key needed from users
- ✅ Monetization-ready architecture

**Just build and ship!** 🚀
