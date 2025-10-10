# Agent Max Desktop

A beautiful Electron-based **floating bar assistant** for **Agent Max Memory System V2**. Always on top, minimal footprint, glassmorphism design.

![Agent Max Desktop](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28.0-47848F.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB.svg)

> **📌 Note:** This app uses a floating bar interface. For detailed technical documentation, see [FLOATBAR_README.md](FLOATBAR_README.md).

## 🎯 Features

- **Floating Bar Interface** - Three modes: mini square (68x68), bar (320x68), card (360x520)
- **Always On Top** - Stays above all windows for instant access
- **Screenshot Capture** - Take screenshots and attach to messages
- **Semantic Suggestions** - AI-powered similar past conversations
- **Chat Interface** - Converse with Agent Max Memory System V2
- **Glassmorphism UI** - Beautiful translucent blur effects
- **Keyboard Shortcuts** - Cmd+Alt+C to toggle, Esc to minimize
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
│   ├── preload.cjs           # Preload script for IPC
│   └── memory-manager.cjs    # Local memory storage
│
├── src/
│   ├── components/
│   │   ├── FloatBar.jsx      # Main floating bar UI
│   │   ├── ErrorBoundary.jsx # Error handling
│   │   └── ProfileCard.jsx   # Profile display
│   │
│   ├── services/
│   │   ├── api.js            # API client
│   │   └── memory.js         # Memory utilities
│   │
│   ├── config/
│   │   ├── apiConfig.js      # API configuration manager
│   │   └── api.js            # API URL resolution
│   │
│   ├── store/
│   │   └── useStore.js       # Zustand state management
│   │
│   ├── styles/
│   │   ├── globals.css       # Glassmorphism styles
│   │   └── welcome.css       # Welcome screen styles
│   │
│   ├── utils/
│   │   └── cn.js             # Utility functions
│   │
│   ├── App.jsx               # Main app component
│   └── main.jsx              # React entry point
│
├── tests/
│   └── features.test.js      # Automated tests
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

## 🎨 UI Modes

### Mini Square Mode (68×68px)
- Compact "MAX" button in top-right corner
- Always on top, translucent glassmorphism
- Click to expand to bar mode
- Draggable anywhere on screen

### Bar Mode (320×68px)
- Horizontal input bar
- Quick message entry
- Auto-expands to card on send
- Minimize button to return to mini

### Card Mode (360×520px)
- Full chat interface with conversation history
- Message input with screenshot button
- Semantic suggestions for similar past queries
- Reset conversation button
- Draggable from header
- Esc or minimize to collapse

## 🎯 Key Features

### Chat Interface
- Send messages to Agent Max API
- View conversation history
- User/agent message bubbles
- Thinking indicators during processing

### Screenshot Capture
- Click camera icon to capture screen
- Blue indicator shows screenshot attached
- Automatic send with message
- Supports image analysis in API

### Semantic Suggestions
- Type 3+ characters to see suggestions
- Shows similar past conversations
- Similarity percentage displayed
- Click suggestion to auto-fill
- Debounced for performance (800ms)

### Welcome Flow
- First-run onboarding experience
- 4-step setup: name, role, use case, work style
- Saves preferences locally
- Skipped on subsequent launches

### Local Memory
- Stores profile data locally
- Preferences and settings persistence
- No cloud sync required
- Privacy-focused storage

## 🎯 API Endpoints Used

The floating bar connects to the following Agent Max API endpoints:

**Core:**
- `GET /health` - Health check and connection monitoring
- `POST /api/v2/chat` - Send chat messages (with optional screenshot)

**Profile:**
- `GET /api/v2/profile` - Get user profile
- `GET /api/v2/profile/greeting` - Get personalized greeting

**Semantic Search:**
- `POST /api/v2/semantic/similar` - Find similar past conversations
- `POST /api/v2/semantic/embed` - Get text embeddings

**Optional (for future features):**
- `GET /api/v1/chat/stream` - Server-sent events for streaming responses
- `POST /api/v2/conversation/message` - Add message to history
- `GET /api/v2/conversation/context` - Get conversation context

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
