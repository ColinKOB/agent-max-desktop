# Agent Max Desktop

**Version:** 2.0 - Clarity  
**Focus:** Behavior-first UX overhaul

A powerful AI assistant for your desktop with a glass-morphism interface and keyboard-first workflow.

---

## 🚀 Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

**First-time users:**
- Press \`Cmd/Ctrl+F\` to search your conversation
- Press \`Cmd/Ctrl+K\` for quick switcher
- Hover over messages for actions
- Your drafts autosave as you type

---

## ✨ What's New in v2.0

### Power Features
- **Search** (Cmd/Ctrl+F) - Find any message instantly
- **Quick Switcher** (Cmd/Ctrl+K) - Jump between conversations
- **Message Actions** - Copy, Regenerate, Edit, Delete (hover or keyboard)
- **Stop/Continue** - Control generation in real-time

### Smart Behaviors
- **Draft Autosave** - Never lose your work (500ms debounce)
- **Auto-Expand** - Window grows when you need space
- **Status Progression** - Connecting → Thinking → Answering
- **Collapsible Thoughts** - Auto-hide after completion

### Safety & Recovery
- **Undo Everywhere** - 5-second restore for destructive actions
- **Mode Memory** - Resumes preferred mode per screen corner
- **IME Protection** - Proper Asian language input handling

See [RELEASE_NOTES_v2.0.md](docs/RELEASE_NOTES_v2.0.md) for full details.

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open search | \`Cmd/Ctrl+F\` |
| Quick switcher | \`Cmd/Ctrl+K\` |
| Toggle mode | \`Cmd/Ctrl+Alt+C\` |
| Copy message | \`C\` (when focused) |
| Regenerate | \`R\` (agent messages) |
| Edit message | \`E\` (user messages) |
| Delete | \`Backspace\` (with confirm) |
| Back out | \`Escape\` |

---

## 📚 Documentation

**📖 [Complete Documentation Index](docs/README.md)** - Navigate all 100+ documentation files organized by category

### Quick Links
- **[Release Notes](docs/RELEASE_NOTES_v2.0.md)** - What's new in v2.0
- **[Ship Checklist](docs/SHIP_CHECKLIST.md)** - Deployment guide
- **[Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)** - Technical deep dive
- **[UX Plan](docs/design/UX_IMPROVEMENT_PLAN.md)** - Full feature roadmap

### Documentation Categories
- **[Guides](docs/guides/)** - Installation, building, deployment, and integration guides
- **[Architecture](docs/architecture/)** - Technical architecture and system design
- **[Design](docs/design/)** - UI/UX design, brand guidelines, and glass effects
- **[Phases](docs/phases/)** - Development phases and milestone completions
- **[Fixes](docs/fixes/)** - Bug fixes and debugging reports
- **[Testing](docs/testing/)** - Test reports, plans, and instructions

---

## 🏗️ Architecture

\`\`\`
agent-max-desktop/
├── src/
│   ├── components/       # React components (FloatBar, etc.)
│   ├── services/         # API, memory, telemetry
│   ├── styles/           # Global CSS with glassmorphism
│   └── utils/            # Helper functions
├── electron/             # Electron main process
└── docs/                 # Additional documentation
\`\`\`

### Key Technologies
- **React** - UI framework
- **Electron** - Desktop app wrapper
- **Vite** - Build tool
- **TailwindCSS** - Utility-first CSS
- **Lucide React** - Icon library

---

## 📊 Telemetry

All events include \`ux_schema: 'v1'\` for future-proof metrics.

**Categories:**
- Search & Switcher
- Generation Control (Stop/Continue)
- Message Actions
- Mode & Composer
- Conversation Management
- Performance (TTFT)

See [UX_IMPROVEMENT_PLAN.md](docs/design/UX_IMPROVEMENT_PLAN.md) for full event list.

The new desktop telemetry broker, including configuration steps for beta
distribution, lives in [docs/TELEMETRY_PIPELINE.md](docs/TELEMETRY_PIPELINE.md).

---

## 🧪 Development

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Package Electron app
npm run package

# Run tests
npm test
\`\`\`

---

## 🎯 Success Metrics (Target)

- Search usage: >20% WAU
- Switcher usage: >15% WAU
- Message actions: >30% WAU
- Stop rate: <8% (quality indicator)
- Mode resume: >60%
- TTFT p95: <1.5s

---

## 🐛 Known Issues

### In v2.0
- Quick switcher shows current conversation only
- Search uses substring matching (no fuzzy)
- Session IDs hardcoded to 'current'

### Planned for v2.1
- Full conversation list
- Fuzzy search (Fuse.js)
- Complete Continue integration
- Memory panel UI
- Export conversations

---

## 🤝 Contributing

1. Read the [UX Improvement Plan](docs/design/UX_IMPROVEMENT_PLAN.md)
2. Check existing issues/PRs
3. Follow the existing code style
4. Add telemetry for new features
5. Update documentation

**Key Principles:**
- Surgical, focused changes
- Telemetry-first approach
- Keyboard-first design
- Undo for destructive actions

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

Built with discipline. Shipped with confidence.

**v2.0 - Clarity** (October 2025)
- 1,500+ lines of UX improvements
- 19 telemetry events
- 0 regressions
- 8 hours of focused work

---

**Questions?** See [SHIP_CHECKLIST.md](docs/SHIP_CHECKLIST.md) for support info.

**Feedback?** We'd love to hear what you think about search, switcher, and message actions!
