# Current UI/UX State - agent-max-desktop

**Date:** October 16, 2025  
**Status:** Production-ready floating assistant with glassmorphism design

---

## 🎨 **Design Philosophy**

**Glass Morphism / Liquid Glass Aesthetic**
- Semi-transparent backgrounds with backdrop blur
- Layered wet highlights and gradients
- Soft rim lighting and shadows
- Inspired by Apple's design language
- Professional, subtle, and modern

---

## 📐 **Three Window Modes**

### 1. **Mini Pill Mode** (68x68px) 🔵 **DO NOT MODIFY**
**Status:** ✅ PERFECT - Leave as-is

**Location:** Lines 338-433 in `globals.css`

**Visual Design:**
- Small square pill that floats on desktop
- Centered logo (36x36px)
- Liquid glass effect with color gradients
- 6-dot drag handle in bottom-left corner
- Revived liquid glass with radial highlight

**Key Features:**
- **Draggable:** Can be moved anywhere on screen
- **Clickable logo:** Expands to bar mode
- **Boundary checking:** Stays on screen automatically
- **Hover effect:** Scales to 1.03x and lifts 2px
- **Active effect:** Scales to 0.98x (press down)

**Styling (DO NOT TOUCH):**
```css
.amx-mini {
  --glass-surface: radial-gradient(...), linear-gradient(...), rgba(255, 255, 255, 0.22);
  --glass-filter: blur(22px) saturate(1.4);
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-base);
}
```

**What makes it work:**
- The 6-dot grid drag handle (`.amx-drag-handle-mini`)
- Logo is clickable but NOT draggable (`-webkit-app-region: no-drag`)
- Window itself IS draggable via the handle
- Perfect 68x68px size matches macOS design guidelines

---

### 2. **Bar Mode** (320x68px) ⚠️ CAN MODIFY CAREFULLY
**Status:** Good, but can enhance input experience

**Location:** Lines 541-617 in `globals.css`

**Visual Design:**
- Horizontal input bar
- Text input takes most space
- Screenshot button (camera icon)
- Minimize button (collapse back to pill)
- Liquid glass with blue-violet-orange tints

**Current Components:**
```
┌────────────────────────────────────────┐
│ 📷  [Type a message...]      [─]      │
└────────────────────────────────────────┘
  ↑          ↑                   ↑
Camera    Input field        Minimize
button
```

**What You Can Modify:**
- Input field text size (currently 16px)
- Placeholder text color
- Add more action buttons (send, voice, etc.)
- Input field border/focus states
- Icon button colors/hover effects

**What to Keep:**
- Overall 320x68px dimensions (resize in `electron/main.cjs` line 394)
- Glass effect variables (`--glass-surface`, `--glass-filter`)
- Border radius consistency

---

### 3. **Card Mode** (360x520px) 🔵 **BACKGROUND PERFECT - Content Flexible**
**Status:** ✅ Background/glass effect is final, content inside can be enhanced

**Location:** Lines 666-692 in `globals.css`

**Visual Design (Glass Container):**
```
┌──────────────────────────────────────┐ ← Glass border
│ ┌────────────────────────────────┐  │ ← Radial highlight
│ │                                 │  │
│ │        CONTENT AREA             │  │ ← This is flexible
│ │    (Messages, inputs, etc)      │  │
│ │                                 │  │
│ │                                 │  │
│ └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Glass Effect (DO NOT MODIFY):**
```css
.amx-card {
  --glass-surface:
    radial-gradient(190% 240% at 25% -12%, rgba(255, 255, 255, 0.16) ...),
    linear-gradient(150deg, rgba(82, 146, 255, 0.16) ...),
    rgba(255, 255, 255, 0.08);
  --glass-filter: blur(14px) saturate(1.25);
}
```

**Current Content Structure:**
```
┌─────────────────────────────────────┐
│  [⚙️] Hi, Colin! [📷] [🗑️]         │ ← Header (draggable)
├─────────────────────────────────────┤
│                                     │
│  💭 Conversation Thoughts           │ ← Scrollable area
│  👤 User message                    │
│  🤖 Assistant response              │
│  💭 Thinking...                     │
│                                     │
├─────────────────────────────────────┤
│  [Type a message...] [→]            │ ← Input footer
└─────────────────────────────────────┘
```

**What You Can Modify (Content Layer):**
- Message bubble styling (`.amx-message-content`)
- Text size and spacing
- Add markdown rendering
- Add code syntax highlighting
- Add copy buttons to code blocks
- Improve message labels
- Add timestamps
- Add avatars
- Enhance scroll area

**What to Keep (Glass Layer):**
- Overall 360x520px card dimensions
- Glass background effect (`--glass-surface`)
- Backdrop filter (`--glass-filter`)
- Border radius (var(--radius-lg) = 16px)
- Shadow and rim lighting

---

## 📱 **Current Components**

### FloatBar.jsx (Main Component)
**Lines:** 1-1623  
**Complexity:** High (52KB file)

**Key Features:**
- ✅ Multi-window state management (pill/bar/card)
- ✅ BroadcastChannel for cross-window sync
- ✅ Screenshot capture integration
- ✅ Streaming responses (word-by-word animation)
- ✅ Semantic suggestions
- ✅ Response caching
- ✅ Telemetry logging
- ✅ Error handling with helpful messages
- ✅ Keyboard shortcuts (Cmd/Ctrl+Alt+C, Escape)
- ✅ Welcome screen/onboarding flow
- ✅ Thought streaming (shows AI reasoning)

**Current Message Types:**
1. **User messages** - Your input (white bubble)
2. **Agent messages** - AI responses (white bubble with teal left border)
3. **Thought messages** - AI thinking process (gray, italic, dashed border)
4. **Debug messages** - System info (dark, monospace)
5. **Error messages** - Failures (red tinted)

**What's Missing (Enhancement Opportunities):**
- ❌ No markdown rendering (plain text only)
- ❌ No code syntax highlighting
- ❌ No copy buttons
- ❌ No message timestamps
- ❌ No message editing
- ❌ No message deletion
- ❌ No conversation export
- ❌ No search within conversation
- ❌ No fact browser UI
- ❌ No session history UI

---

## 🎨 **Design Tokens** (tokens.css)

**Brand Colors:**
```css
--primary: #10121E;        /* Deep navy (text)  */
--accent: #0FB5AE;         /* Teal (brand color) */
--accent-hover: #0D9A94;   /* Darker teal */
--accent-press: #0B7F7A;   /* Even darker */
```

**Surface Colors:**
```css
--background: #FAFAFA;     /* Off-white */
--surface: #FFFFFF;        /* Pure white */
--subsurface: #F5F5F7;     /* Light gray */
```

**Text Colors:**
```css
--text: #1A1D2E;           /* Dark (primary) */
--muted: #6C727F;          /* Gray (secondary) */
```

**Spacing Scale:**
```css
--space-1: 4px    /* Tiny */
--space-2: 8px    /* Small */
--space-3: 12px   /* Medium */
--space-4: 16px   /* Large */
--space-5: 24px   /* XL */
--space-6: 32px   /* XXL */
```

**Border Radius:**
```css
--radius-sm: 8px   /* Pill buttons */
--radius-md: 12px  /* Cards, inputs */
--radius-lg: 16px  /* Windows, panels */
```

**Typography:**
```css
--text-title-size: 22px    /* Headers */
--text-body-size: 16px     /* Normal text */
--text-caption-size: 13px  /* Small text */
```

---

## 💬 **Message Bubble Styling**

### User Messages
```css
.amx-message-user .amx-message-content {
  background: rgba(255, 255, 255, 0.95);  /* Nearly opaque white */
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 16px;
  line-height: 1.5;
}
```

**Visual:**
```
┌────────────────────────────┐
│ YOUR MESSAGE               │
│ Appears here in white      │
│ with dark text             │
└────────────────────────────┘
```

### Assistant Messages
```css
.amx-message-agent .amx-message-content {
  background: rgba(255, 255, 255, 0.95);  /* Same as user */
  border-left: 2px solid var(--accent);   /* Teal left border (distinguisher) */
  color: var(--text);
  font-size: 16px;
  line-height: 1.5;
}
```

**Visual:**
```
│┌──────────────────────────┐
││ AI RESPONSE              │  ← Blue/teal left edge
││ Response text appears    │
││ here in white            │
│└──────────────────────────┘
```

### Thought Messages (AI Thinking)
```css
.amx-message-thought .amx-message-content {
  background: var(--subsurface);  /* Light gray */
  border: 1px dashed var(--border);
  color: var(--muted);
  font-style: italic;
  font-size: 13px;
  opacity: 0.85;
}
```

**Visual:**
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  💭 Thinking about...        (Gray, dashed border)
  Analyzing your request...   (Italic text)
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## 🔧 **What You Can Safely Change**

### ✅ **Safe to Modify (Content Layer)**

1. **Message Bubbles**
   - Text size and font family
   - Padding and spacing
   - Add markdown rendering
   - Add syntax highlighting
   - Add copy buttons
   - Add timestamps
   - Add avatars

2. **Input Field**
   - Placeholder text
   - Text size
   - Border styling
   - Add send button
   - Add voice input button
   - Add emoji picker

3. **Header Bar**
   - Add more buttons
   - Change icon set
   - Add profile dropdown
   - Add status indicators

4. **Thought Stream**
   - Improve formatting
   - Add progress indicators
   - Add step numbers
   - Add tool icons

5. **Empty State**
   - Better illustration
   - Quick action buttons
   - Example prompts

### ⚠️ **Modify with Caution (Layout)**

1. **Window Dimensions**
   - Must update in `electron/main.cjs` (lines 388-400)
   - Keep aspect ratios reasonable
   - Test boundary checking after changes

2. **Mode Transitions**
   - Animation timing is critical
   - Don't break BroadcastChannel sync
   - Maintain state consistency

### 🔵 **DO NOT TOUCH (Glass Effects)**

1. **Mini Pill Background** (`.amx-mini`)
   - Gradient layers are perfect
   - Blur amount is tuned
   - Saturation is calibrated

2. **Card Background** (`.amx-card`)
   - Glass composition is final
   - Backdrop filter is optimized
   - Rim lighting is precise

3. **Design Tokens** (`tokens.css`)
   - Brand colors are set
   - Spacing scale is standardized
   - Keep consistency

---

## 📊 **Current Features**

### ✅ **Working Features**

1. **Multi-Window System**
   - Pill → Bar → Card transitions
   - Cross-window state sync (BroadcastChannel)
   - Separate pill and card windows in Electron

2. **Chat Functionality**
   - Send messages to backend
   - Receive streaming responses
   - Word-by-word animation (40ms per word)
   - Thought streaming (AI reasoning steps)

3. **Screenshot Integration**
   - Capture screen via Electron API
   - Attach to message
   - Send with context

4. **Smart Features**
   - Response caching (instant for repeated questions)
   - Semantic suggestions (similar past questions)
   - Error recovery with helpful messages
   - Connection status monitoring

5. **Keyboard Shortcuts**
   - `Cmd/Ctrl+Alt+C`: Toggle pill → bar → card
   - `Escape`: Collapse to pill
   - `Enter`: Send message
   - `Shift+Enter`: New line

6. **Telemetry**
   - Logs interactions
   - Tracks performance
   - Records errors
   - Monitors success rates

7. **Memory Integration**
   - Saves conversations via memory service
   - Extracts facts from responses
   - Builds context for API calls
   - Shows fact count toasts

### ❌ **Missing Features (Enhancement Needed)**

1. **Message Rendering**
   - No markdown support
   - No code highlighting
   - No link previews
   - No image rendering

2. **Conversation Management**
   - No message editing
   - No message deletion
   - No conversation export
   - No search within chat

3. **Memory UI**
   - No fact browser
   - No fact editor
   - No session history
   - No memory manager

4. **Settings**
   - No theme toggle
   - No API config UI
   - No privacy controls
   - No appearance options

5. **Interactions**
   - No copy buttons
   - No message reactions
   - No message threading
   - No voice input

---

## 🎯 **Recommended Enhancements** (Priority Order)

### 1. **Add Markdown Rendering** (2-3 hours)
**Why:** Makes responses readable (code blocks, lists, bold/italic)
**Where:** `.amx-message-content` in FloatBar.jsx
**Library:** `react-markdown` + `react-syntax-highlighter`

**Before:**
```
The code is: function test() { console.log("hello"); }
```

**After:**
```javascript
function test() {
  console.log("hello");
}
```

### 2. **Add Copy Buttons** (1 hour)
**Why:** Easy to copy code/text
**Where:** Code blocks in messages
**Implementation:** Button in top-right of code block

### 3. **Add Timestamps** (30 min)
**Why:** Track when messages were sent
**Where:** Below message content
**Format:** "2:34 PM" or "2 minutes ago"

### 4. **Improve Input Field** (2 hours)
**Why:** Better UX for typing
**Features:**
- Send button (visible on text entry)
- Character counter
- Multi-line support indicator
- Auto-resize textarea

### 5. **Add Message Actions** (1-2 hours)
**Why:** More control over messages
**Features:**
- Copy message text
- Regenerate response
- Delete message
- Edit message (user only)

### 6. **Build Memory Manager** (4-6 hours)
**Why:** Users need to see/edit facts
**Components:**
- Facts browser (list, search, filter)
- Fact editor (modal)
- Session history
- Message search

---

## 🚫 **What NOT to Change**

### 1. **Mini Pill Styling**
```css
/* DO NOT MODIFY */
.amx-mini {
  --glass-surface: /* Perfect gradient layers */
  --glass-filter: blur(22px) saturate(1.4);
}
```
**Why:** Perfectly tuned liquid glass effect. Took days to get right.

### 2. **Card Background**
```css
/* DO NOT MODIFY */
.amx-card::before {
  background: /* Perfect glass composition */
  backdrop-filter: blur(14px) saturate(1.25);
}
```
**Why:** Professional glassmorphism. Matches Apple aesthetic.

### 3. **Design Tokens**
```css
/* tokens.css - DO NOT MODIFY */
--accent: #0FB5AE;  /* Brand teal */
--radius-lg: 16px;   /* Standard corners */
```
**Why:** System-wide consistency. Changes ripple everywhere.

### 4. **Window Resize Logic**
**File:** `electron/main.cjs` lines 388-400  
**Why:** Carefully calibrated dimensions. Changing breaks layout.

### 5. **BroadcastChannel Sync**
**File:** `FloatBar.jsx` lines 267-353  
**Why:** Complex state management. Breaking this breaks multi-window.

---

## 📖 **Code Examples for Common Changes**

### Add Markdown Rendering
```javascript
// Install: npm install react-markdown react-syntax-highlighter

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// In message content:
<ReactMarkdown
  components={{
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  }}
>
  {message.content}
</ReactMarkdown>
```

### Add Copy Button to Code Blocks
```javascript
const CodeBlock = ({ code, language }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button onClick={handleCopy} className="btn-secondary">
          <Copy size={14} /> Copy
        </button>
      </div>
      <SyntaxHighlighter language={language} style={oneDark}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
};
```

### Add Timestamp to Messages
```javascript
const formatTime = (isoString) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
};

// In message component:
<div className="message-timestamp">
  {formatTime(message.created_at)}
</div>
```

---

## 🎨 **Visual Summary**

```
CURRENT STATE:
┌─────────────────────────────────────────┐
│                                         │
│  🔵 Mini Pill (PERFECT - DON'T TOUCH)  │
│     - Liquid glass effect               │
│     - Draggable with 6-dot handle       │
│     - 68x68px square                    │
│                                         │
│  ⚠️  Bar Mode (CAN ENHANCE INPUT)       │
│     - Horizontal input bar              │
│     - 320x68px                          │
│     - Glass effect is good              │
│                                         │
│  🟢 Card Mode (CONTENT NEEDS WORK)      │
│     - Background: PERFECT ✅            │
│     - Content: NEEDS ENHANCEMENT ⚠️     │
│       • Add markdown rendering          │
│       • Add code highlighting           │
│       • Add copy buttons                │
│       • Add timestamps                  │
│       • Improve message UX              │
│     - 360x520px                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📝 **Summary**

**What's Great:**
- ✅ Glass morphism design is professional and polished
- ✅ Multi-window system works smoothly
- ✅ Core chat functionality is solid
- ✅ Backend integration is working
- ✅ Memory integration is functional

**What Needs Work:**
- ❌ Message rendering (no markdown/code highlighting)
- ❌ Message interactions (no copy/edit/delete)
- ❌ Memory UI (no fact browser/editor)
- ❌ Settings UI (no configuration panel)
- ❌ Conversation management (no export/search)

**Golden Rule:**
- 🔵 **DO NOT TOUCH:** Mini pill glass effect, card background glass effect
- 🟢 **SAFE TO MODIFY:** Message content, input field, buttons, icons
- ⚠️ **MODIFY CAREFULLY:** Window dimensions, transitions, state management

---

**Next Steps:** Focus on enhancing the **content layer** inside the card while preserving the beautiful glass container.
