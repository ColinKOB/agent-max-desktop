# Agent Max Desktop

**Version:** 1.1.12
**Author:** Colin O'Brien
**Homepage:** https://agentmax.app

A cross-platform AI desktop assistant with glass-morphism UI, intelligent memory system, and autonomous task execution.

---

## Quick Start

```bash
npm install
npm run dev
```

For Electron development:
```bash
npm run electron:dev
```

---

## Features

### Core Capabilities
- **Glass-Morphism UI** - Modern frosted glass interface with backdrop blur effects
- **Floating Pill Interface** - Minimalist, always-on-top design that expands dynamically
- **Keyboard-First Workflow** - Full keyboard navigation with Cmd/Ctrl shortcuts
- **Real-time Status** - Connection state indicators (Connecting → Thinking → Answering)

### Memory System
- **Profile Management** - User profiles with interaction tracking
- **Facts Storage** - Knowledge stored as domain/predicate/object triplets
- **Hybrid Search** - Local-first search with cloud fallback
- **Client-side Embeddings** - Privacy-focused embeddings via Transformers.js (all-MiniLM-L6-v2)
- **Offline Support** - Sync queue for offline operations

### Autonomous Execution
- **Pull-based Model** - Client polls for task status (no SSE streaming)
- **Intent Detection** - AI identifies user intent before execution
- **Intent Confirmation** - Approval dialogs for sensitive operations
- **Live Activity Feed** - Real-time updates during task execution
- **Code Execution** - Local Python/shell script execution
- **macOS AppleScript** - Native automation support

### Integrations
- **Google OAuth** - Gmail, Calendar, Drive, and Contacts access
- **Stripe Billing** - Subscription and credit-based payment system
- **Supabase** - PostgreSQL backend with authentication and RLS
- **PostHog Analytics** - 50+ event types for product telemetry

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | `Cmd/Ctrl+F` |
| Quick Switcher | `Cmd/Ctrl+K` |
| Toggle Mode | `Cmd/Ctrl+Alt+C` |
| Copy Message | `C` (when focused) |
| Regenerate | `R` (agent messages) |
| Edit Message | `E` (user messages) |
| Delete | `Backspace` (with confirm) |
| Back/Cancel | `Escape` |

---

## Tech Stack

### Frontend
- **React** 18.2.0 - UI framework
- **Vite** 5.0.8 - Build tool and dev server
- **TailwindCSS** 3.4.0 - Utility-first CSS
- **Framer Motion** 12.23.24 - Animations
- **React Router** 7.9.4 - Client-side routing
- **Zustand** 4.4.7 - Lightweight state management
- **Lucide React** 0.294.0 - Icon library

### Backend Integration
- **Axios** 1.12.2 - HTTP client with retry support
- **Supabase** 2.76.0 - PostgreSQL + Auth + RLS
- **Stripe** 5.2.0 / 8.1.0 - Payments
- **PostHog** 1.306.2 - Product analytics

### Desktop (Electron)
- **Electron** 28.0.0 - Desktop wrapper
- **Electron Builder** 24.9.1 - Packaging (Mac/Win/Linux)
- **Electron Updater** 6.6.2 - Auto-updates
- **Better SQLite3** 9.2.2 - Local database
- **Keytar** 7.9.0 - Secure credential storage (OS keychain)

### AI/ML
- **@xenova/transformers** 2.17.1 - Client-side embeddings
- **Puppeteer** 21.11.0 - Web automation

### Testing
- **Playwright** 1.56.1 - E2E testing
- **Vitest** 1.0.4 - Unit testing
- **Jest** 30.2.0 - JavaScript testing
- **Testing Library** - React component testing

---

## Project Structure

```
agent-max-desktop/
├── src/
│   ├── App.jsx                    # Root component
│   ├── main.jsx                   # Vite entry point
│   ├── components/                # React components
│   │   ├── FloatBar/              # Main UI (AppleFloatBar, ComposerBar)
│   │   ├── onboarding/            # User setup flow
│   │   ├── ExecutionProgress/     # Task status UI
│   │   ├── LiveActivityFeed/      # Real-time activity
│   │   └── GoogleConnect.jsx      # Google OAuth
│   ├── services/                  # API and business logic
│   │   ├── api.js                 # REST API client
│   │   ├── supabase.js            # Supabase client
│   │   ├── supabaseMemory.js      # Memory operations
│   │   ├── pullAutonomous.js      # Task execution service
│   │   ├── hybridSearch.js        # Local + cloud search
│   │   ├── embeddings.js          # Embedding generation
│   │   └── analytics.js           # PostHog tracking
│   ├── store/                     # Zustand state management
│   ├── config/                    # API and feature configuration
│   ├── hooks/                     # Custom React hooks
│   ├── lib/                       # Shared utilities
│   ├── styles/                    # CSS (glass-morphism effects)
│   └── utils/                     # Helper functions
├── electron/
│   ├── main/                      # Main process (main.cjs, menu.cjs)
│   ├── autonomous/                # Task execution engine
│   │   ├── pullExecutor.cjs       # Pull-based executor
│   │   ├── macosAppleScript.cjs   # macOS automation
│   │   └── executorManager.cjs    # Executor lifecycle
│   ├── memory/                    # Local memory backend
│   ├── integrations/              # Third-party integrations
│   └── preload/                   # Electron preload scripts
├── tests/                         # Test files (e2e, unit, integration)
├── supabase/                      # Supabase configuration
└── build/                         # App icons and resources
```

---

## Development Commands

```bash
# Development
npm run dev                        # Start Vite dev server
npm run electron:dev               # Run Electron in dev mode
npm run electron:dev:prodlike      # Production-like build
npm run electron:watch:prodlike    # Watch with production env

# Building
npm run build                      # Build for production
npm run electron:build             # Package for all platforms
npm run electron:build:mac         # macOS (DMG + ZIP)
npm run electron:build:win         # Windows (NSIS + ZIP)
npm run electron:build:linux       # Linux (AppImage + DEB + RPM)

# Testing
npm test                           # Run Vitest
npm run test:watch                 # Watch mode
npm run test:ui                    # Vitest UI
npm run test:coverage              # Coverage report
npm run test:jest                  # Jest tests
npm run test:e2e                   # Playwright E2E tests
npm run test:e2e:ui                # E2E with UI
npm run test:api                   # API tests
npm run test:unit                  # Unit tests only
npm run test:all                   # Run all tests

# Code Quality
npm run lint                       # ESLint check
npm run lint:fix                   # Auto-fix linting
npm run stylelint                  # CSS linting
npm run stylelint:fix              # Fix CSS issues
npm run format                     # Prettier format
npm run format:check               # Check formatting
```

---

## Environment Variables

Create a `.env` file based on `.env.example`:

### Core Settings
- `VITE_API_URL` - Backend API URL
- `VITE_API_KEY` - API authentication key
- `VITE_ENVIRONMENT` - Environment (development/production/beta)

### Services
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_GOOGLE_API_KEY` - Google API key

### Feature Flags
- `VITE_ENABLE_PAYMENTS` - Enable Stripe billing
- `VITE_ENABLE_GOOGLE_INTEGRATION` - Enable Google OAuth
- `VITE_ENABLE_HYBRID_SEARCH` - Enable semantic search
- `VITE_ENABLE_ANALYTICS` - Enable PostHog tracking

### Developer Settings
- `VITE_DEBUG_MODE` - Enable debug logging
- `VITE_BETA_MODE` - Enable beta features
- `VITE_UPDATE_CHANNEL` - Auto-update channel

---

## Architecture Highlights

### State Management
- Zustand for minimal, performant global state
- Persisted to localStorage for session recovery

### API Communication
- Axios with automatic retry (3 retries, exponential backoff)
- 60-second timeout
- Auto-detect local backend in development

### Search Architecture
- **Local**: IndexedDB with keyword/semantic indexes (offline capable)
- **Cloud**: Supabase RPC for comprehensive search
- **Hybrid**: Local-first, merge with cloud, rank combined results
- **Embeddings**: 384-dimensional vectors via all-MiniLM-L6-v2

### Security
- IPC message validation for Electron
- Keytar for secure credential storage
- Row-level security in Supabase
- Sandbox enabled for Electron

---

## Telemetry

Event tracking with PostHog includes:
- App lifecycle (launched, ready, activated, closed, updated)
- Onboarding flow events
- Authentication events
- Billing and subscription events
- Chat and conversation events
- Search and navigation
- Message actions
- Error tracking

All events include `ux_schema: 'v1'` for versioned metrics.

---

## Contributing

1. Follow the existing code style
2. Add telemetry for new features
3. Include tests for new functionality
4. Use keyboard-first design principles
5. Implement undo for destructive actions

---

## License

MIT License - See LICENSE file for details

---

**Copyright © 2025 Colin O'Brien**
