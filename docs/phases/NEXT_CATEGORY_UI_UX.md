# Phase 2: UI/UX Enhancement - Detailed Plan

**Category:** Frontend UI/UX (agent-max-desktop)  
**Priority:** HIGH  
**Time Estimate:** 2-3 days  
**Prerequisites:** ✅ Memory Vault complete

---

## 🎯 Goal

Build a modern, intuitive chat interface with powerful memory management capabilities that makes the Memory Vault accessible and useful to users.

---

## 📋 Task List

### 1. Wire Memory Vault (1-2 hours) ✅ Ready
- [ ] Update `electron/main.cjs` to initialize VaultIntegration
- [ ] Update `electron/preload.cjs` to expose vault methods
- [ ] Test vault API from DevTools console
- [ ] Verify migration runs on first start

### 2. Chat Interface (4-6 hours)
- [ ] Modern message bubbles (user vs assistant)
- [ ] Markdown rendering with syntax highlighting
- [ ] Code block copy buttons
- [ ] Streaming animation (typewriter effect)
- [ ] Loading/thinking indicators
- [ ] Error states with retry
- [ ] Auto-scroll to bottom

### 3. Memory Manager UI (6-8 hours)
- [ ] Facts browser with search/filter
- [ ] Fact editor modal (edit confidence, PII, value)
- [ ] Session history viewer
- [ ] Message search within sessions
- [ ] Delete confirmations
- [ ] Bulk actions

### 4. Settings Panel (3-4 hours)
- [ ] Identity management (name, ID display)
- [ ] Privacy settings (PII levels, consent)
- [ ] API configuration (backend URL)
- [ ] Appearance (theme, dark mode)
- [ ] Vault health check display
- [ ] About page

### 5. Onboarding (2-3 hours)
- [ ] Welcome screen (first run)
- [ ] Quick start tutorial
- [ ] Migration progress display
- [ ] Example conversations

---

## 🏗️ Architecture

```
┌──────────────────────────────────────┐
│   React UI Components                │
│                                      │
│   Chat ◄──► Memory Manager ◄──► Settings
│     │              │                │
│     └──────┬───────┴────────────────┘
│            │                          
│       IPC Bridge (preload.cjs)       
│            │                          
└────────────┼──────────────────────────┘
             │
┌────────────▼──────────────────────────┐
│   Memory Vault (Electron Main)        │
│   - Context selection                 │
│   - Fact storage                      │
│   - Session management                │
└───────────────────────────────────────┘
```

---

## 🎨 Tech Stack

- **Framework:** React 18
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Markdown:** react-markdown
- **Code:** react-syntax-highlighter
- **State:** React Context / Zustand

---

## 📝 Key Integration Points

### Chat → Vault
```javascript
// On user send
const handleSend = async (message) => {
  // 1. Save user message
  await window.vault.addMessage(sessionId, 'user', message);
  
  // 2. Build context
  const { data: context } = await window.vault.buildContext(message, 1400);
  
  // 3. Send to backend (Phase 3)
  const response = await sendToBackend(message, context);
  
  // 4. Save assistant response
  await window.vault.addMessage(sessionId, 'assistant', response.text);
  
  // 5. Reinforce facts
  await window.vault.reinforce(response.usedFactIds);
};
```

### Memory Manager → Vault
```javascript
// Load facts
const facts = await window.vault.getAllFacts();

// Search facts
const results = await window.vault.searchFacts(query);

// Update fact
await window.vault.updateFact(id, { 
  object: newValue, 
  confidence: 0.9 
});

// Delete fact
await window.vault.deleteFact(id);
```

---

## ✅ Testing Checklist

- [ ] Vault initializes on app start
- [ ] Can send/receive messages
- [ ] Messages saved to vault
- [ ] Facts display correctly
- [ ] Can edit/delete facts
- [ ] Search works
- [ ] Settings persist
- [ ] Dark mode toggles
- [ ] No console errors

---

## 🚀 Success Criteria

1. Users can have conversations that are saved to vault
2. Users can view and manage their facts
3. Users can search through history
4. Interface is intuitive and modern
5. No data loss during operations
6. Responsive and performant (< 100ms interactions)

---

**Next:** Start with Task 1 (Wire Memory Vault) - takes 1-2 hours, enables all other work.
