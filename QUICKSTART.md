# Agent Max Desktop - Quick Start Guide

Get up and running with Agent Max Desktop in 5 minutes!

## ⚡ Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Agent Max API** - Must be running on `http://localhost:8000`

## 🚀 Installation Steps

### Step 1: Start the Agent Max API

Open a terminal and run:

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
python agent_max.py --api
```

✅ Verify it's running by opening: http://localhost:8000/docs

### Step 2: Install Dependencies

Open a **new terminal** and run:

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
npm install
```

This will install all required packages (may take 2-3 minutes).

### Step 3: Start the App

```bash
npm run electron:dev
```

This will:
- Start the Vite dev server
- Launch the Electron app
- Open with hot reload enabled

## 🎉 You're Ready!

The app should now be running. You'll see:

1. **Sidebar** on the left with navigation
2. **Dashboard** showing your profile
3. **Connection status** indicator (green = connected)

## 🎯 First Steps

### 1. Check API Connection

- Look for the green dot next to your profile in the sidebar
- If red, go to **Settings** → **Test Connection**

### 2. Set Your Name

- Go to **Dashboard**
- Your profile will show "Guest" initially
- The API will learn your name from conversations

### 3. Try the Features

**Dashboard:**
- View your profile and stats
- See pending tasks

**Conversation:**
- Send a message to Agent Max
- Add tasks using the sidebar
- Complete tasks when done

**Knowledge:**
- View stored facts
- Add new facts manually
- Extract facts from text automatically

**Search:**
- Search for similar past goals
- Adjust similarity threshold
- View success patterns

**Preferences:**
- View explicit preferences
- See implicit preferences with confidence scores

**Settings:**
- Toggle dark mode
- Configure API settings
- Clear cache if needed

## 🎨 Keyboard Shortcuts

- **Enter** - Send message in chat
- **Shift+Enter** - New line in chat
- **Cmd+R** - Refresh app
- **Cmd+Option+I** - Open DevTools (development mode)

## 🐛 Common Issues

### "Cannot connect to API"

**Solution:**
1. Make sure Agent Max API is running
2. Check it's on port 8000: `curl http://localhost:8000/health`
3. Go to Settings → Test Connection

### "Port 5173 already in use"

**Solution:**
```bash
lsof -ti:5173 | xargs kill -9
npm run electron:dev
```

### App won't start

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run electron:dev
```

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check the [API Documentation](http://localhost:8000/docs)
- Explore all 6 pages in the app

## 💡 Tips

1. **Dark Mode** - Toggle in Settings for a beautiful dark theme
2. **Auto-Extract Facts** - Paste text in Knowledge page to extract facts automatically
3. **Semantic Search** - Adjust threshold slider to find more/fewer similar goals
4. **Tasks** - Add tasks from conversations, complete them from Dashboard or Conversation page
5. **Preferences** - Watch as the system learns your preferences over time

## 🎊 Enjoy!

You're all set! Start exploring Agent Max Desktop.

For help, check the README.md or open an issue.

---

**Happy exploring! 🚀**
