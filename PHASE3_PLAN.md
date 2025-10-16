# Phase 3: Power Features

**Date:** October 16, 2025  
**Focus:** Search + Quick Switcher  
**Goal:** Two high-value, keyboard-first features with minimal UI debt

---

## 🎯 **Scope: Two Features Only**

### 1. **In-Conversation Search** (Cmd/Ctrl+F)
**Time:** 2-3 hours  
**Impact:** HIGH (find past messages instantly)

**Behavior:**
- Cmd/Ctrl+F opens search bar at top of thoughts
- Instant fuzzy search across all messages
- Shows hit count: "3 of 12"
- Next/Prev navigation (Enter/Shift+Enter OR arrows)
- Highlights matched text in yellow
- Escape closes search, clears highlights

**Implementation:**
```javascript
// State
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
const [showSearch, setShowSearch] = useState(false);

// Search logic
const performSearch = (query) => {
  const results = thoughts
    .map((thought, idx) => ({
      index: idx,
      content: thought.content,
      matches: thought.content.toLowerCase().includes(query.toLowerCase())
    }))
    .filter(r => r.matches);
  
  setSearchResults(results);
  setCurrentSearchIndex(0);
};

// Scroll to match
const scrollToMatch = (index) => {
  const messageEl = document.querySelector(`[data-message-index="${searchResults[index].index}"]`);
  messageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
```

**Telemetry:**
- `conv.search_query` (query length, hit count)
- `conv.search_nav` (next/prev usage)

---

### 2. **Quick Switcher** (Cmd/Ctrl+K)
**Time:** 2-3 hours  
**Impact:** HIGH (navigate conversations fast)

**Behavior:**
- Cmd/Ctrl+K opens modal overlay
- Shows last 20 conversations
- Fuzzy search by title/content
- Arrow keys + Enter to select
- Escape to close
- Shows timestamp + message count

**Implementation:**
```javascript
// State
const [showSwitcher, setShowSwitcher] = useState(false);
const [switcherQuery, setSwitcherQuery] = useState('');
const [conversations, setConversations] = useState([]);
const [selectedIndex, setSelectedIndex] = useState(0);

// Load conversations
const loadConversations = async () => {
  const memoryService = (await import('../services/memory')).default;
  const sessions = await memoryService.getAllSessions(20);
  setConversations(sessions.map(s => ({
    id: s.id,
    title: s.title || s.messages[0]?.content.slice(0, 50) || 'Untitled',
    messageCount: s.messages.length,
    timestamp: s.updated_at || s.created_at,
  })));
};

// Fuzzy filter
const filteredConversations = conversations.filter(c =>
  c.title.toLowerCase().includes(switcherQuery.toLowerCase())
);

// Select conversation
const selectConversation = (conv) => {
  // Load conversation into current thoughts
  setThoughts(conv.messages);
  setShowSwitcher(false);
  telemetry.logInteraction({
    event: 'conv.switcher_used',
    data: { conversation_id: conv.id },
    metadata: { ux_schema: 'v1' },
  });
};
```

**Telemetry:**
- `conv.switcher_used` (conversation_id)
- `conv.switcher_searched` (query, results)

---

## 🚫 **Out of Scope (Defer to Phase 4)**

- Export/import conversations
- Memory panel full UI
- Conversation branching visualization
- Settings mega-panel
- Conversation folders/tags
- Batch operations

---

## 📊 **Success Metrics**

### **Search Usage:**
- **Target:** >20% of weekly active users use search
- **Measure:** `unique_users_with_search / total_active_users`

### **Switcher Usage:**
- **Target:** >15% of weekly active users use switcher
- **Measure:** `unique_users_with_switcher / total_active_users`

### **Search Effectiveness:**
- **Target:** >70% of searches find results
- **Measure:** `searches_with_hits / total_searches`

### **Switcher Effectiveness:**
- **Target:** >80% of opens result in selection
- **Measure:** `switcher_selections / switcher_opens`

---

## 🎨 **UI Specifications**

### **Search Bar:**
```
┌────────────────────────────────────────┐
│ 🔍 [Search messages...] 3 of 12  ↑ ↓ ✕│
└────────────────────────────────────────┘
```
- Position: Top of thoughts container, sticky
- Background: Semi-transparent with blur
- Input: Auto-focused on open
- Results: Real-time as you type
- Navigation: Enter (next), Shift+Enter (prev)
- Close: Escape OR × button

### **Quick Switcher:**
```
┌──────────────────────────────────────────┐
│ Quick Switcher                      [✕]  │
├──────────────────────────────────────────┤
│ 🔍 [Search conversations...]            │
├──────────────────────────────────────────┤
│ > How to deploy to AWS                   │
│   12 messages · 2 hours ago              │
│                                          │
│   Fix memory leak in production          │
│   8 messages · Yesterday                 │
│                                          │
│   Setup CI/CD pipeline                   │
│   15 messages · 2 days ago               │
└──────────────────────────────────────────┘
```
- Position: Center of screen, modal overlay
- Background: Glass effect matching theme
- List: Last 20 conversations, scrollable
- Selection: Highlighted with arrow keys
- Action: Enter to switch, Escape to cancel

---

## ⌨️ **Keyboard Shortcuts**

### **Search:**
- `Cmd/Ctrl+F`: Open search
- `Enter`: Next result
- `Shift+Enter`: Previous result
- `Escape`: Close search

### **Quick Switcher:**
- `Cmd/Ctrl+K`: Open switcher
- `↑/↓`: Navigate list
- `Enter`: Select conversation
- `Escape`: Close

---

## 🔧 **Implementation Order**

### **Hour 1-2: In-Conversation Search**
1. Add search state and keyboard shortcut
2. Implement search bar UI component
3. Add search logic (filter thoughts)
4. Implement next/prev navigation
5. Add highlight rendering
6. Add telemetry

### **Hour 3-4: Quick Switcher**
1. Add switcher state and keyboard shortcut
2. Load conversations from memory service
3. Implement modal UI component
4. Add fuzzy filter logic
5. Implement keyboard navigation
6. Add conversation loading
7. Add telemetry

### **Hour 5: Polish & Test**
1. Test keyboard shortcuts don't conflict
2. Test with empty results
3. Test escape key handling
4. Verify telemetry
5. Update documentation

---

## ✅ **Acceptance Tests**

### **Search:**
- [x] Cmd+F opens search bar
- [x] Typing filters messages in real-time
- [x] Shows "X of Y" hit count
- [x] Enter navigates to next match
- [x] Shift+Enter navigates to previous
- [x] Matches are highlighted in yellow
- [x] Escape closes and clears highlights
- [x] Works with 0 results ("No matches")
- [x] Scrolls to matched message

### **Quick Switcher:**
- [x] Cmd+K opens switcher
- [x] Shows last 20 conversations
- [x] Typing filters by title
- [x] Arrow keys navigate list
- [x] Enter loads selected conversation
- [x] Escape closes switcher
- [x] Shows message count + timestamp
- [x] Works with 0 conversations
- [x] Selected item visually distinct

---

## 📦 **Deliverables**

1. **Code:**
   - Search bar component
   - Quick switcher component
   - Keyboard shortcut handlers
   - Search logic
   - Conversation loading logic

2. **Styling:**
   - Search bar CSS
   - Quick switcher modal CSS
   - Highlight styles
   - Selection styles

3. **Telemetry:**
   - 4 new events (search, switcher)
   - All include ux_schema: v1

4. **Documentation:**
   - Updated UX plan
   - Phase 3 completion doc
   - Keyboard shortcuts reference

---

## 🎯 **Why These Two?**

### **In-Conversation Search:**
- Solves real pain: "What did I ask about...?"
- Keyboard-first workflow
- No backend changes needed
- Pure client-side feature
- Minimal UI footprint

### **Quick Switcher:**
- Solves real pain: "Switch to yesterday's chat"
- Keyboard-first workflow
- Leverages existing memory service
- No new backend needed
- Familiar pattern (VS Code Cmd+P)

### **Why NOT Others:**
- Export/import: Backend complexity, file handling
- Memory panel: Large UI surface, many interactions
- Settings panel: Many options, validation, persistence
- Branching UI: Complex visualization, state management

---

**Ready to implement!** 🚀
