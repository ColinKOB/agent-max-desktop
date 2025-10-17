# Agent Max - Floating Bar UI

The Agent Max desktop app has been transformed into a minimal, always-on-top floating bar with glassmorphism design.

## 🎯 Features

- **Tiny footprint**: 360×80px pill in inactive mode
- **Expands on demand**: 360×520px card when active
- **Always on top**: Stays above all other windows
- **Glassmorphism**: Translucent blur effect with gradient backdrop
- **Frameless**: No window chrome, just the content
- **Draggable**: Drag from the top 20px of the active card
- **Keyboard shortcuts**: 
  - `Cmd+Alt+C` (Mac) / `Ctrl+Alt+C` (Win) - Toggle open/close
  - `Esc` - Collapse to pill mode
- **Live streaming**: Real-time thoughts and progress updates
- **Command execution**: Run terminal commands with confirmation
- **Cross-platform**: Works on macOS, Windows, Linux

## 🚀 Quick Start

### 1. Start the Backend API

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/Agent_Max"
source venv/bin/activate
python agent_max.py --api
```

The API should be running on `http://localhost:8000`

### 2. Start the Electron App

```bash
cd "/Users/colinobrien/Desktop/Coding Projects/agent-max-desktop"
npm run electron:dev
```

This will:
- Start Vite dev server on port 5173
- Launch Electron with the floating bar in the top-right corner

## 🎨 UI Modes

### Inactive Mode (Pill)
- **Size**: 360×80px
- **State**: Shows single input field
- **Action**: Click or focus input to expand

### Active Mode (Card)
- **Size**: 360×520px
- **Sections**:
  - Header with user greeting and minimize button
  - Thoughts stream (scrollable)
  - Progress bar (when active)
  - Command preview (when available)
  - Message input with send button

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Alt+C` / `Ctrl+Alt+C` | Toggle FloatBar open/close |
| `Esc` | Collapse to pill mode |
| `Enter` | Send message |
| `Shift+Enter` | New line (in message input) |

## 🔧 Technical Details

### Window Configuration
- **Frame**: None (frameless window)
- **Transparent**: Yes
- **Always on top**: Yes
- **Resizable**: No
- **Position**: Top-right corner with 16px margin
- **Vibrancy**: HUD effect (macOS)

### Files Modified

1. **electron/main.cjs** - Window configuration, IPC handlers
2. **electron/preload.cjs** - Exposed Electron APIs
3. **src/App.jsx** - Simplified to just FloatBar
4. **src/components/FloatBar.jsx** - Main UI component
5. **src/styles/globals.css** - Glassmorphism styles
6. **src/services/streaming.js** - SSE streaming service

### IPC Handlers

```javascript
// Resize window (expand/collapse)
window.electron.resizeWindow(width, height)

// Execute terminal command
window.electron.executeCommand(command)

// Copy to clipboard
window.electron.copyToClipboard(text)

// Get screen dimensions
window.electron.getScreenSize()
```

## 🔒 Security

### Command Execution
- Commands are **never** auto-executed
- User must explicitly click "Run" button
- Confirmation modal shows command before execution
- All commands are logged to `~/Library/Logs/AgentMax/commands.log` (macOS)

### Transparency Fallback
- If user has `prefers-reduced-transparency` enabled, the UI switches to solid backgrounds
- Maintains accessibility for users who need it

## 🎛️ Customization

### Change Window Size

Edit `electron/main.cjs`:

```javascript
const windowWidth = 360;  // Change width
const windowHeight = 80;  // Change height (pill mode)
```

And in `FloatBar.jsx`:

```javascript
await window.electron.resizeWindow(360, 520); // Card mode height
```

### Change Position

Edit `electron/main.cjs`:

```javascript
const margin = 16; // Distance from screen edge
x: screenWidth - windowWidth - margin,  // Right side
y: margin,  // Top
```

### Modify Colors

Edit `src/styles/globals.css` in the `/* FLOATBAR GLASSMORPHISM STYLES */` section:

```css
.amx-pill {
  background: rgba(24, 24, 28, 0.45); /* Adjust transparency */
  backdrop-filter: blur(16px) saturate(1.1); /* Adjust blur */
}
```

## 🔌 Backend Integration

### Streaming Endpoint

The FloatBar expects a streaming endpoint at:

```
GET /v1/chat/stream?message=<user_message>&user_id=<user_id>
```

**Event Types:**
- `thought` - Intermediate processing steps (string)
- `progress` - Completion percentage (0-100)
- `command` - Executable command preview (JSON object)
- `final` - Conversation complete (JSON with optional command)

**Example SSE Response:**

```
event: thought
data: Analyzing your request...

event: progress
data: 30

event: thought
data: Found solution: install jq package

event: progress
data: 80

event: command
data: {"command": "brew install jq", "description": "Install jq JSON processor"}

event: progress
data: 100

event: final
data: {"status": "success", "command": "brew install jq"}
```

### Enable Streaming

Uncomment the SSE code in `src/components/FloatBar.jsx`:

```javascript
useEffect(() => {
  if (!isOpen) return;
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const es = new EventSource(`${apiUrl}/v1/chat/stream`, { withCredentials: true });
  // ... rest of SSE setup
}, [isOpen]);
```

## 📦 Building for Production

```bash
# Build the app
npm run electron:build

# Output will be in dist/ directory
```

### macOS Signing

Add to `package.json`:

```json
{
  "build": {
    "appId": "com.agentmax.desktop",
    "productName": "Agent Max",
    "mac": {
      "category": "public.app-category.productivity",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist"
    }
  }
}
```

## 🐛 Troubleshooting

### Window doesn't appear
- Check if process is running: `ps aux | grep electron`
- Check console for errors: Uncomment `mainWindow.webContents.openDevTools()` in `electron/main.cjs`

### Transparent background not working
- macOS: Ensure "Reduce transparency" is OFF in System Preferences → Accessibility → Display
- Windows: Ensure Windows 10 build 1903+ or Windows 11

### Commands not executing
- Check terminal permissions in System Preferences → Security & Privacy → Privacy → Automation
- Check command logs: `~/Library/Logs/AgentMax/commands.log`

### API not connecting
- Verify API is running: `curl http://localhost:8000/health`
- Check `.env` file has correct `VITE_API_URL`
- Check CORS settings in backend allow `http://localhost:5173`

## 📝 Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:8000
VITE_API_KEY=                     # Optional API key
```

## 🎯 Next Steps

1. **Connect backend streaming** - Implement SSE endpoint in Agent_Max API
2. **Add more commands** - Extend command execution capabilities
3. **Persistent state** - Save window position, preferences
4. **System tray** - Add tray icon for quick access
5. **Auto-launch** - Start on system boot (optional)

## 📚 Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Window Vibrancy](https://github.com/arkenthera/electron-vibrancy)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Glassmorphism Design](https://hype4.academy/articles/design/glassmorphism-in-user-interfaces)

---

**Made with ❤️ for Agent Max Memory System V2**
