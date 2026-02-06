# Personalized Onboarding: "What Can Max Do For You?"

## Goal
Transform the generic onboarding examples into personalized suggestions based on the user's actual installed applications and desktop files. This creates an immediate "wow" moment where users see Max can work with their specific tools.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  App Scanner    │    │  Desktop Scanner │                    │
│  │  /Applications  │    │  ~/Desktop       │                    │
│  └────────┬────────┘    └────────┬─────────┘                    │
│           │                      │                               │
│           └──────────┬───────────┘                               │
│                      ▼                                           │
│           ┌─────────────────────┐                               │
│           │  IPC: get-user-apps │                               │
│           └──────────┬──────────┘                               │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  app-capabilities.json                       ││
│  │  Maps 100+ apps to categories, icons, and example prompts   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              OnboardingFlow.jsx - DemoStep                   ││
│  │  - Receives installed apps list                              ││
│  │  - Matches against capability map                            ││
│  │  - Renders personalized examples                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: App Discovery Service (Electron Main)

### File: `src/main/services/appDiscovery.js`

```javascript
// Functions to implement:

async function scanInstalledApps() {
  // 1. Read /Applications directory
  // 2. Filter for .app bundles
  // 3. Extract app names (remove .app extension)
  // 4. Optionally read Info.plist for bundle IDs
  // Return: Array of { name: string, bundleId?: string, path: string }
}

async function scanDesktopFiles() {
  // 1. Read ~/Desktop directory
  // 2. Categorize files by extension
  // 3. Count file types (documents, images, etc.)
  // Return: { documents: number, images: number, spreadsheets: number, etc. }
}

async function getUserContext() {
  // Combines both scans
  // Returns: { installedApps: [], desktopContext: {} }
}
```

### IPC Handler in `main.js` or `preload.js`:
```javascript
ipcMain.handle('get-user-apps', async () => {
  return await getUserContext();
});
```

## Phase 2: App Capability Map

### File: `src/data/app-capabilities.json`

Structure for each app:
```json
{
  "apps": {
    "Notion": {
      "bundleId": "notion.id",
      "category": "productivity",
      "icon": "FileText",
      "color": "#000000",
      "prompts": [
        "Open Notion",
        "Create a new page in Notion",
        "Search my Notion workspace"
      ]
    }
  },
  "categories": {
    "productivity": { "label": "Productivity", "icon": "Briefcase", "color": "#3b82f6" },
    "development": { "label": "Development", "icon": "Code", "color": "#22c55e" },
    // etc.
  }
}
```

### Categories to cover:
1. **Productivity** - Notion, Obsidian, Bear, Apple Notes, Evernote, Things, Todoist, OmniFocus, etc.
2. **Communication** - Slack, Discord, Zoom, Microsoft Teams, Messages, WhatsApp, Telegram, etc.
3. **Creative** - Figma, Sketch, Adobe CC (Photoshop, Illustrator, etc.), Canva, Affinity, etc.
4. **Development** - VS Code, Xcode, Terminal, iTerm, GitHub Desktop, Postman, Docker, etc.
5. **Browsers** - Safari, Chrome, Firefox, Arc, Brave, Edge, etc.
6. **Finance** - QuickBooks, Excel, Numbers, Mint, etc.
7. **Entertainment** - Spotify, Apple Music, Netflix, YouTube, etc.
8. **Utilities** - Finder, Preview, Calendar, Reminders, etc.
9. **Writing** - Pages, Word, Google Docs, Ulysses, iA Writer, etc.
10. **Email** - Mail, Outlook, Spark, Airmail, etc.

### Prompt types per app:
- **Open/Launch**: "Open [App]"
- **Create**: "Create a new [thing] in [App]"
- **Search**: "Search for [x] in [App]"
- **Action**: App-specific actions ("Send a message in Slack", "Start a meeting in Zoom")

## Phase 3: Onboarding UI Integration

### Modified DemoStep Component

```jsx
function DemoStep({ onNext, onBack }) {
  const [userApps, setUserApps] = useState(null);
  const [personalizedExamples, setPersonalizedExamples] = useState([]);

  useEffect(() => {
    // Fetch user's installed apps via IPC
    window.electron?.invoke('get-user-apps').then(context => {
      setUserApps(context);
      // Match against capability map and select best examples
      const examples = generatePersonalizedExamples(context.installedApps);
      setPersonalizedExamples(examples);
    });
  }, []);

  // ... render personalized examples
}
```

### Example Selection Logic:
1. Match installed apps against capability map
2. Prioritize diverse categories (don't show 3 productivity apps)
3. Pick the most compelling prompts (actions > open commands)
4. Show 4-6 examples maximum
5. Fallback to generic examples if < 3 matches

### UI Design:
- Keep "What can Max do for you?" heading
- Replace orange circle with a grid/carousel of app icons
- Show personalized prompts with app icons
- Subtle animation as examples appear
- Optional: "See more" to expand full list

## File Structure

```
agent-max-desktop/
├── src/
│   ├── main/
│   │   ├── services/
│   │   │   └── appDiscovery.js          # NEW: App scanning logic
│   │   └── main.js                       # Add IPC handler
│   ├── data/
│   │   └── app-capabilities.json         # NEW: 100+ app mappings
│   ├── components/
│   │   └── onboarding/
│   │       └── OnboardingFlow.jsx        # MODIFY: DemoStep component
│   └── preload/
│       └── preload.js                    # Expose IPC if needed
```

## App List Coverage (Minimum 100 Apps)

### Productivity (20+)
- Notion, Obsidian, Bear, Apple Notes, Evernote, OneNote
- Things 3, Todoist, OmniFocus, Reminders, TickTick
- Fantastical, Calendar, Calendly
- 1Password, Bitwarden, LastPass
- Alfred, Raycast, Spotlight

### Communication (15+)
- Slack, Discord, Microsoft Teams, Zoom, Google Meet
- Messages, WhatsApp, Telegram, Signal
- FaceTime, Skype, Webex
- Mail, Outlook, Spark, Airmail, Gmail (web)

### Creative (15+)
- Figma, Sketch, Adobe Photoshop, Adobe Illustrator, Adobe XD
- Canva, Affinity Designer, Affinity Photo
- Final Cut Pro, iMovie, DaVinci Resolve, Adobe Premiere
- Logic Pro, GarageBand, Audacity
- Blender, Cinema 4D

### Development (20+)
- Visual Studio Code, Xcode, IntelliJ IDEA, WebStorm, PyCharm
- Terminal, iTerm2, Warp, Hyper
- GitHub Desktop, Sourcetree, GitKraken
- Postman, Insomnia, Charles
- Docker Desktop, Vagrant
- Sublime Text, Atom, Nova, BBEdit
- TablePlus, Sequel Pro, MongoDB Compass

### Browsers (8+)
- Safari, Google Chrome, Firefox, Arc, Brave
- Microsoft Edge, Opera, Vivaldi

### Finance (8+)
- QuickBooks, Xero, FreshBooks
- Excel, Numbers, Google Sheets
- Robinhood, Coinbase, Personal Capital

### Entertainment (10+)
- Spotify, Apple Music, YouTube Music
- Netflix, Disney+, Hulu, Amazon Prime Video
- VLC, IINA, Plex
- Steam, Epic Games

### Utilities (15+)
- Finder, Preview, QuickTime
- CleanMyMac, DaisyDisk, AppCleaner
- Bartender, Rectangle, Magnet
- TimeMachine, Carbon Copy Cloner
- Dropbox, Google Drive, OneDrive, iCloud

### Writing & Documents (10+)
- Pages, Microsoft Word, Google Docs
- Ulysses, iA Writer, Scrivener
- PDF Expert, Adobe Acrobat
- Grammarly, Hemingway

## Implementation Notes

1. **Privacy**: We only READ app names and file types, never file contents
2. **Performance**: Scan asynchronously during first launch, cache results
3. **Fallback**: Always have generic examples ready if scan fails
4. **Future**: Could use this data for smarter AI suggestions later

## Success Metrics

- User sees at least 3 apps they recognize
- Examples feel personally relevant
- "Wow" factor on first impression
- Higher engagement with onboarding completion
