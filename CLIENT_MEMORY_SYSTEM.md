# 🧠 Client-Side Memory System - Complete Guide

## 🎯 Overview

The Agent Max Desktop app now stores **all user memories locally** on your computer. This provides:

- ✅ **Privacy** - Your data never leaves your machine (except context sent with chat)
- ✅ **Security** - Memories encrypted with machine-specific key
- ✅ **Portability** - Take your memories with you (backup/restore)
- ✅ **Performance** - Instant access, no server dependency
- ✅ **Personalization** - AI knows you from your local data

---

## 📍 **Where Are Memories Stored?**

Memories are stored in your **app data directory**:

- **macOS:** `~/Library/Application Support/agent-max-desktop/memories/`
- **Windows:** `%APPDATA%/agent-max-desktop/memories/`
- **Linux:** `~/.config/agent-max-desktop/memories/`

### **Files Created:**

```
memories/
├── profile.json          # Your user profile
├── facts.json           # Facts about you
├── conversations.json   # Chat history
└── preferences.json     # Your preferences
```

All files are **encrypted** using a key derived from your machine ID.

---

## 🔐 **Security Features**

### **Encryption:**
- AES-256-CBC encryption
- Machine-specific encryption key
- Unique initialization vector per file
- Key derived from machine ID + app name

### **Privacy:**
- No cloud storage
- No server-side persistence (unless you explicitly use server-only API)
- Context sent to API is temporary (only for that request)
- Full control over your data

---

## 🚀 **How It Works**

### **Architecture:**

```
┌─────────────────────────────────────────┐
│         React App (Browser)             │
│  ┌─────────────────────────────────┐   │
│  │   Memory Service (memory.js)    │   │
│  └─────────────────────────────────┘   │
│              ↓ IPC calls                │
└──────────────│──────────────────────────┘
               ↓
┌──────────────│──────────────────────────┐
│    Electron Main Process                │
│  ┌─────────────────────────────────┐   │
│  │  LocalMemoryManager (Node.js)   │   │
│  │  - Reads/writes encrypted files │   │
│  │  - Manages local storage        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│      Local File System (Encrypted)      │
│   profile.json, facts.json, etc.        │
└─────────────────────────────────────────┘
               ↓ (Context sent with API call)
┌─────────────────────────────────────────┐
│      Agent Max API (FastAPI)            │
│   - Receives context from client        │
│   - Generates AI response               │
│   - Doesn't store client memories       │
└─────────────────────────────────────────┘
```

### **Data Flow:**

1. **User sends message**
2. **App stores message locally** (encrypted)
3. **App builds context** from local memories
4. **App sends message + context to API**
5. **API generates response** using context
6. **App stores AI response locally** (encrypted)
7. **App displays response** to user

**Key Point:** The API is stateless for client-managed memories. All memory persistence happens locally.

---

## 💻 **Usage in React Components**

### **1. Initialize Memory Service**

```javascript
import memoryService from '../services/memory';

function App() {
  useEffect(() => {
    // Initialize on app start
    memoryService.initialize().then(profile => {
      console.log('User profile:', profile);
      console.log('User name:', profile.name || 'Not set');
    });
  }, []);
}
```

### **2. Send Message with Context**

```javascript
import memoryService from '../services/memory';
import api from '../services/api';

async function sendMessage(messageText) {
  try {
    // This automatically:
    // - Adds message to local memory
    // - Builds context from local data
    // - Sends to API with context
    // - Stores AI response locally
    const response = await memoryService.sendMessageWithContext(messageText, api);
    
    console.log('AI Response:', response.response);
    console.log('Used context:', response.context_used);
    
    return response;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### **3. Manage User Profile**

```javascript
import memoryService from '../services/memory';

// Get profile
const profile = await memoryService.getProfile();

// Set user name
await memoryService.setUserName('John');

// Update profile
await memoryService.updateProfile({
  timezone: 'America/New_York',
  language: 'en'
});

// Get personalized greeting
const greeting = await memoryService.getPersonalizedGreeting();
// Returns: "Good morning, John! Welcome back."
```

### **4. Manage Facts**

```javascript
import memoryService from '../services/memory';

// Get all facts
const facts = await memoryService.getFacts();

// Set a fact
await memoryService.setFact('personal', 'occupation', 'Software Engineer');
await memoryService.setFact('preferences', 'favorite_color', 'blue');

// Delete a fact
await memoryService.deleteFact('personal', 'occupation');
```

### **5. Manage Preferences**

```javascript
import memoryService from '../services/memory';

// Get all preferences
const prefs = await memoryService.getPreferences();

// Set explicit preference
await memoryService.setPreference('notification_sound', true, 'explicit');

// Set implicit preference (learned from behavior)
await memoryService.setPreference('response_style', 'concise', 'implicit');

// Get specific preference
const notificationSound = await memoryService.getPreference('notification_sound');
```

### **6. Manage Conversation History**

```javascript
import memoryService from '../services/memory';

// Get recent messages
const recent = await memoryService.getRecentMessages(10);

// Clear conversation (start fresh)
await memoryService.clearConversation();

// Manually add message (usually done automatically)
await memoryService.addMessage('user', 'Hello!');
await memoryService.addMessage('assistant', 'Hi there!');
```

### **7. Backup & Restore**

```javascript
import memoryService from '../services/memory';

// Export memories (downloads JSON file)
const backup = await memoryService.exportMemories();
// Downloads: agent-max-memories-2025-10-09.json

// Import memories (from file input)
function handleImport(event) {
  const file = event.target.files[0];
  memoryService.importMemories(file).then(() => {
    console.log('Memories imported successfully!');
  });
}
```

### **8. View Statistics**

```javascript
import memoryService from '../services/memory';

const stats = await memoryService.getStats();
console.log(stats);
// {
//   user_name: "John",
//   interactions: 42,
//   facts_stored: 15,
//   conversations: 3,
//   messages: 127,
//   preferences: 8,
//   storage_location: "~/Library/Application Support/agent-max-desktop/memories"
// }

// Get storage location
const location = await memoryService.getStorageLocation();
console.log('Memories stored at:', location);
```

---

## 🎨 **Complete Chat Component Example**

```javascript
import { useState, useEffect } from 'react';
import memoryService from '../services/memory';
import api from '../services/api';
import toast from 'react-hot-toast';

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    // Initialize and load conversation history
    async function init() {
      await memoryService.initialize();
      const profile = await memoryService.getProfile();
      setUserName(profile.name);
      
      const recent = await memoryService.getRecentMessages(20);
      setMessages(recent);
    }
    init();
  }, []);

  async function handleSend() {
    if (!input.trim()) return;

    setLoading(true);
    const userMessage = input;
    setInput('');

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Send with local context
      const response = await memoryService.sendMessageWithContext(userMessage, api);

      // Add AI response to UI
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.response 
      }]);

      // Show if AI used user's name or facts
      if (response.context_used.using_client_memory) {
        toast.success('AI is using your local memories!');
      }

    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        {userName ? `Chat with Agent Max - ${userName}` : 'Chat with Agent Max'}
      </div>
      
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

---

## 📊 **What Gets Sent to the API**

When you send a message, here's what context gets sent:

```json
{
  "message": "What should I have for lunch?",
  "user_context": {
    "profile": {
      "name": "John",
      "interaction_count": 42,
      "last_interaction": "2025-10-09T16:30:00Z"
    },
    "facts": {
      "personal": {
        "occupation": "Software Engineer"
      },
      "preferences": {
        "favorite_food": "Italian",
        "dietary": "vegetarian"
      }
    },
    "recent_messages": [
      { "role": "user", "content": "I'm hungry", "timestamp": "..." },
      { "role": "assistant", "content": "What are you in the mood for?", "timestamp": "..." }
    ],
    "preferences": {
      "explicit": {
        "notification_sound": true
      },
      "implicit": {
        "response_style": "concise"
      }
    }
  }
}
```

**The AI then responds using this context:**
> "Since you're vegetarian and love Italian food, how about a nice Margherita pizza or pasta primavera? There's that Italian place you mentioned last week."

---

## 🔧 **Advanced Features**

### **Automatic Fact Extraction**

The memory service automatically extracts facts from conversations:

```javascript
// User says: "My name is John"
// → Automatically stores: facts.personal.name = "John"
// → Automatically updates: profile.name = "John"

// User says: "I like pizza"
// → Automatically stores: facts.preferences.likes = "pizza"

// User says: "I am a developer"
// → Automatically stores: facts.personal.description = "developer"
```

### **Session Management**

Each app session is tracked separately:

```javascript
// New session started on app launch
const sessionId = await memoryService.initialize();

// Clear session (but keep profile/facts)
await memoryService.clearConversation();

// Sessions are stored in conversations.json with timestamps
```

### **Direct Electron Access**

You can also use the Electron API directly:

```javascript
// From React component
const profile = await window.electron.memory.getProfile();
const facts = await window.electron.memory.getFacts();
const stats = await window.electron.memory.getStats();
```

---

## 🎉 **Benefits**

### **For Users:**
- ✅ Complete privacy - data stays on your machine
- ✅ Personalized AI that truly knows you
- ✅ Works offline (reading memories)
- ✅ Backup/restore your memories
- ✅ No subscription needed for memory storage

### **For Developers:**
- ✅ Simple API - just use `memoryService`
- ✅ Automatic context management
- ✅ Encrypted by default
- ✅ Cross-platform (macOS, Windows, Linux)
- ✅ Easy to test and debug

### **For AI Responses:**
- ✅ Consistent personalization
- ✅ Remembers past conversations
- ✅ Knows user preferences
- ✅ Uses learned facts
- ✅ Better context awareness

---

## 🚦 **Getting Started**

### **1. Install Dependencies**

```bash
cd agent-max-desktop
npm install
```

### **2. Start the App**

```bash
npm run electron:dev
```

### **3. Use in Components**

```javascript
import memoryService from './services/memory';

// Initialize
await memoryService.initialize();

// Send message with context
const response = await memoryService.sendMessageWithContext('Hello!', api);
```

---

## 📚 **API Reference**

See [`src/services/memory.js`](./src/services/memory.js) for complete API documentation.

**Key Methods:**
- `initialize()` - Set up memory system
- `sendMessageWithContext(message, api)` - Send with local context
- `getProfile()` - Get user profile
- `setUserName(name)` - Set user name
- `getFacts()` - Get all facts
- `setFact(category, key, value)` - Store a fact
- `getRecentMessages(count)` - Get conversation history
- `exportMemories()` - Backup memories
- `importMemories(file)` - Restore from backup
- `getStats()` - View statistics

---

## 🎯 **Summary**

**You now have:**
- ✅ Fully local memory storage (encrypted)
- ✅ AI that uses your personal context
- ✅ Privacy-first architecture
- ✅ Easy-to-use API
- ✅ Backup/restore capabilities
- ✅ Cross-platform support

**Your memories live in the app, travel with you, and make Agent Max truly personal!** 🧠✨
