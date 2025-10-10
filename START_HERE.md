# 🚀 START HERE - Agent Max Desktop

Welcome! This guide will get you up and running in **5 minutes**.

## 📦 What You Have

A complete **Electron + React desktop application** for Agent Max Memory System V2 with:

✅ **6 Full Pages:**
- Dashboard (profile, stats, tasks)
- Conversation (chat interface)
- Knowledge (facts management)
- Search (semantic similarity)
- Preferences (explicit & implicit)
- Settings (theme, API config)

✅ **Beautiful UI:**
- Modern TailwindCSS design
- Dark mode support
- Smooth animations
- Responsive layout

✅ **Complete API Integration:**
- 26 endpoints fully connected
- Real-time data sync
- Error handling
- Loading states

## ⚡ Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
npm install
```

⏱️ Takes 2-3 minutes

### Step 2: Start Agent Max API

**Open a new terminal:**

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
python agent_max.py --api
```

✅ Verify: http://localhost:8000/docs

### Step 3: Start the Desktop App

**Back in agent-max-desktop terminal:**

```bash
npm run electron:dev
```

🎉 **The app will open automatically!**

## 🔍 Verify Everything Works

Run the verification script:

```bash
./verify-setup.sh
```

This checks:
- ✅ Node.js installed
- ✅ Dependencies installed
- ✅ API running
- ✅ All files present

## 📚 Documentation

Choose your path:

### 🏃 **I want to start NOW**
→ Read [QUICKSTART.md](QUICKSTART.md) (5 min read)

### 📖 **I want detailed instructions**
→ Read [INSTALLATION.md](INSTALLATION.md) (10 min read)

### 🔧 **I want to understand everything**
→ Read [README.md](README.md) (15 min read)

### 📊 **I want to see what was built**
→ Read [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) (complete overview)

## 🎯 First-Time Usage

Once the app is running:

1. **Check Connection**
   - Look for green dot in sidebar
   - If red, go to Settings → Test Connection

2. **Explore Dashboard**
   - View your profile
   - See interaction stats
   - Check pending tasks

3. **Try Conversation**
   - Send a message
   - Add a task
   - Complete a task

4. **Browse Knowledge**
   - View stored facts
   - Add a new fact
   - Try extracting facts from text

5. **Test Search**
   - Search for similar goals
   - Adjust similarity threshold
   - View patterns

6. **Check Preferences**
   - View explicit preferences
   - See implicit preferences
   - Add a preference

7. **Configure Settings**
   - Toggle dark mode
   - Test API connection
   - View app info

## 🎨 Features Highlights

### Dashboard
- Personalized greeting
- Real-time statistics
- Pending tasks management
- Insights display

### Conversation
- Beautiful chat interface
- Message history
- Task sidebar
- Session management

### Knowledge Base
- Category filtering
- Search functionality
- Inline editing
- Auto-extract facts

### Semantic Search
- AI-powered similarity
- Adjustable threshold
- Success indicators
- Pattern analysis

### Preferences
- Explicit preferences
- Implicit learning
- Confidence scores
- Easy management

### Settings
- Light/Dark theme
- API configuration
- Connection testing
- Cache management

## 🐛 Common Issues

### "Cannot connect to API"
```bash
# Check if API is running
curl http://localhost:8000/health

# If not, start it
cd ../Agent_Max
python agent_max.py --api
```

### "Port 5173 already in use"
```bash
lsof -ti:5173 | xargs kill -9
npm run electron:dev
```

### "npm: command not found"
Install Node.js from: https://nodejs.org/

### Dependencies won't install
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## 📁 Project Structure

```
agent-max-desktop/
├── 📄 START_HERE.md          ← You are here!
├── 📄 QUICKSTART.md           ← 5-minute guide
├── 📄 INSTALLATION.md         ← Detailed setup
├── 📄 README.md               ← Full documentation
├── 📄 PROJECT_SUMMARY.md      ← What was built
│
├── electron/                  ← Electron configuration
├── src/                       ← React application
│   ├── components/            ← Reusable components
│   ├── pages/                 ← 6 main pages
│   ├── services/              ← API client
│   ├── store/                 ← State management
│   └── styles/                ← Global styles
│
├── package.json               ← Dependencies
├── vite.config.js             ← Build config
└── tailwind.config.js         ← Styling config
```

## 🚀 Available Commands

```bash
# Development
npm run electron:dev      # Start app in dev mode
npm run dev               # Start Vite only

# Production
npm run electron:build    # Build for production
npm run build             # Build React app

# Utilities
./verify-setup.sh         # Verify setup
```

## 🎓 Learning Path

**Beginner:**
1. Read START_HERE.md (this file)
2. Follow Quick Start steps
3. Explore the app
4. Read QUICKSTART.md

**Intermediate:**
1. Read INSTALLATION.md
2. Read README.md
3. Explore source code
4. Customize settings

**Advanced:**
1. Read PROJECT_SUMMARY.md
2. Study API integration
3. Modify components
4. Build custom features

## 💡 Pro Tips

1. **Use Dark Mode** - Toggle in Settings for a beautiful dark theme
2. **Extract Facts** - Paste text in Knowledge page to auto-extract
3. **Adjust Search** - Lower threshold finds more similar goals
4. **Watch Preferences** - System learns your preferences over time
5. **Check DevTools** - Press Cmd+Option+I to see console logs

## 🎯 Next Steps

After getting the app running:

1. ✅ Verify API connection (green dot in sidebar)
2. ✅ Set your name (Dashboard will show it)
3. ✅ Send a test message (Conversation page)
4. ✅ Add a fact (Knowledge page)
5. ✅ Try semantic search (Search page)
6. ✅ Toggle dark mode (Settings page)

## 📞 Need Help?

1. Check the troubleshooting section above
2. Run `./verify-setup.sh` to diagnose issues
3. Check terminal output for errors
4. Open DevTools (Cmd+Option+I) for console logs
5. Verify API is running at http://localhost:8000/docs

## 🎊 You're Ready!

Everything is set up and ready to go. Just run:

```bash
npm install                    # Install dependencies
npm run electron:dev           # Start the app
```

**Enjoy Agent Max Desktop! 🚀**

---

**Questions? Check the documentation files listed above.**

**Ready to start? Run the Quick Start commands! ⚡**
