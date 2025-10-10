# Agent Max Desktop

A beautiful Electron desktop application for **Agent Max Memory System V2**. This app provides a modern, intuitive interface for interacting with your Agent Max API.

![Agent Max Desktop](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28.0-47848F.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB.svg)

## 🎯 Features

- **Dashboard** - Overview of your profile, stats, and pending tasks
- **Conversation** - Chat interface with message history and task management
- **Knowledge Base** - Manage facts with categories, search, and auto-extraction
- **Semantic Search** - Find similar past goals with AI-powered similarity matching
- **Preferences** - View and manage explicit and implicit preferences
- **Settings** - Configure API connection, theme, and app preferences
- **Dark Mode** - Full dark mode support with smooth transitions
- **Real-time API** - Connects to your existing Agent Max API (localhost:8000)

## 📋 Prerequisites

Before running this app, you need:

1. **Node.js 18+** installed
2. **Agent Max API running** on `http://localhost:8000`

### Starting the Agent Max API

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
python agent_max.py --api
```

Verify it's running by visiting: http://localhost:8000/docs

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
npm install
```

### 2. Start Development Mode

```bash
npm run electron:dev
```

This will:
- Start the Vite dev server on `http://localhost:5173`
- Launch the Electron app automatically
- Enable hot reload for development

## 📦 Building for Production

### Build the App

```bash
npm run electron:build
```

This creates distributable packages in the `dist-electron/` directory:

- **macOS:** `.dmg` and `.zip` files
- **Windows:** `.exe` installer and portable version
- **Linux:** `.AppImage` and `.deb` packages

## 🏗️ Project Structure

```
agent-max-desktop/
├── electron/
│   ├── main.cjs              # Electron main process
│   └── preload.cjs           # Preload script for IPC
│
├── src/
│   ├── components/           # Reusable React components
│   │   ├── Sidebar.jsx
│   │   ├── ProfileCard.jsx
│   │   ├── ChatInterface.jsx
│   │   └── FactsManager.jsx
│   │
│   ├── pages/                # Main application pages
│   │   ├── Dashboard.jsx
│   │   ├── Conversation.jsx
│   │   ├── Knowledge.jsx
│   │   ├── Search.jsx
│   │   ├── Preferences.jsx
│   │   └── Settings.jsx
│   │
│   ├── services/
│   │   └── api.js            # API client (connects to localhost:8000)
│   │
│   ├── store/
│   │   └── useStore.js       # Zustand state management
│   │
│   ├── styles/
│   │   └── globals.css       # Global styles + Tailwind
│   │
│   ├── utils/
│   │   └── cn.js             # Utility functions
│   │
│   ├── App.jsx               # Main app component
│   └── main.jsx              # React entry point
│
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── electron-builder.json
```

## 🔌 API Configuration

The app connects to your Agent Max API at `http://localhost:8000` by default.

### Change API URL

1. Go to **Settings** page in the app
2. Update the **API URL** field
3. Click **Save Settings**
4. Click **Test Connection** to verify

Or set it via environment variable:

```bash
# Create .env file
echo "VITE_API_URL=http://localhost:8000" > .env
```

### API Key (Optional)

If your API requires authentication:

1. Go to **Settings** page
2. Enter your **API Key**
3. Click **Save Settings**

## 🎨 Tech Stack

- **Desktop Framework:** Electron 28
- **Frontend Framework:** React 18
- **Build Tool:** Vite 5
- **Styling:** TailwindCSS 3
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Notifications:** React Hot Toast
- **Date Utilities:** date-fns

## 📱 Pages Overview

### Dashboard
- Profile card with greeting
- Interaction statistics
- Pending tasks list
- Quick insights

### Conversation
- Chat interface with message bubbles
- Real-time message history
- Task management sidebar
- Clear conversation option

### Knowledge Base
- View all stored facts
- Filter by category (personal, technical, preferences, etc.)
- Search within facts
- Add/edit/delete facts
- Auto-extract facts from text

### Semantic Search
- Search for similar past goals
- Adjustable similarity threshold
- View success/failure indicators
- Semantic patterns visualization
- Cache statistics

### Preferences
- View explicit preferences
- View implicit preferences with confidence scores
- Add/edit/delete preferences
- Confidence visualization

### Settings
- Theme switcher (light/dark)
- API configuration
- Connection testing
- Clear local cache
- App information

## 🎯 API Endpoints Used

The app uses the following Agent Max API endpoints:

**Profile:**
- `GET /api/v2/profile` - Get user profile
- `GET /api/v2/profile/greeting` - Get personalized greeting
- `POST /api/v2/profile/name` - Set user name
- `GET /api/v2/profile/insights` - Get insights

**Facts:**
- `GET /api/v2/facts` - Get all facts
- `POST /api/v2/facts/extract` - Extract facts from text
- `PUT /api/v2/facts/{category}/{key}` - Set a fact
- `DELETE /api/v2/facts/{category}/{key}` - Delete a fact

**Semantic:**
- `POST /api/v2/semantic/similar` - Find similar goals
- `GET /api/v2/semantic/patterns` - Get patterns
- `GET /api/v2/semantic/cache/stats` - Cache stats

**Conversation:**
- `POST /api/v2/conversation/message` - Add message
- `GET /api/v2/conversation/context` - Get context
- `POST /api/v2/conversation/task` - Add/complete task
- `GET /api/v2/conversation/tasks` - Get tasks

**Preferences:**
- `GET /api/v2/preferences` - Get all preferences
- `PUT /api/v2/preferences/{key}` - Set preference
- `DELETE /api/v2/preferences/{key}` - Delete preference

**Health:**
- `GET /health` - Health check

## 🐛 Troubleshooting

### App won't connect to API

1. Verify the API is running: `curl http://localhost:8000/health`
2. Check the API URL in Settings
3. Click "Test Connection" in Settings
4. Check browser console for errors (Cmd+Option+I)

### Port 5173 already in use

```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9
```

### Build fails

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Dark mode not working

1. Go to Settings
2. Toggle theme
3. Refresh the app (Cmd+R)

## 🔧 Development Scripts

```bash
# Start Vite dev server only
npm run dev

# Start Electron in development mode
npm run electron:dev

# Build for production
npm run electron:build

# Preview production build
npm run preview
```

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-api-key-here
```

## 🤝 Contributing

This is a personal project, but feel free to fork and customize for your needs!

## 📄 License

MIT License - feel free to use this project however you'd like.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/) and [TailwindCSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- Connects to [Agent Max Memory System V2](../Agent_Max/)

---

**Enjoy using Agent Max Desktop! 🚀**

For API documentation, visit: http://localhost:8000/docs
