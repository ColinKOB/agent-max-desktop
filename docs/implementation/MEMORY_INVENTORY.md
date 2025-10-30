# Electron Memory API Inventory

**Date**: 2025-10-29

---

## Electron.memory API Calls

### Profile Operations
- `window.electron.memory.getProfile()` - App.jsx, AppleFloatBar.jsx, utils/contextBuilder.js
- `window.electron.memory.updateProfile(updates)` - src/services/memory.js
- `window.electron.memory.setName(name)` - src/services/memory.js
- `window.electron.memory.incrementInteraction()` - src/services/memory.js

### Session Operations
- `window.electron.memory.startSession()` - AppleFloatBar.jsx (multiple), src/services/memory.js
- `window.electron.memory.addMessage(role, content, sessionId)` - AppleFloatBar.jsx, src/services/memory.js
- `window.electron.memory.getRecentMessages(count, sessionId)` - AppleFloatBar.jsx, utils/contextBuilder.js
- `window.electron.memory.clearSession(sessionId)` - src/services/memory.js
- `window.electron.memory.getAllSessions()` - AppleFloatBar.jsx, ConversationHistory.jsx

### Facts Operations
- `window.electron.memory.getFacts()` - AppleFloatBar.jsx, src/services/memory.js, utils/contextBuilder.js
- `window.electron.memory.setFact(category, key, value)` - src/services/memory.js
- `window.electron.memory.deleteFact(category, key)` - src/services/memory.js
- `window.electron.memory.reinforceFact(factId)` - utils/contextBuilder.js

### Preferences Operations
- `window.electron.memory.getPreferences()` - AppleFloatBar.jsx, src/services/memory.js, utils/contextBuilder.js
- `window.electron.memory.setPreference(key, value, type)` - src/services/memory.js
- `window.electron.memory.getPreference(key)` - AppleFloatBar.jsx, App.jsx

### Context Operations
- `window.electron.memory.buildContext()` - src/services/memory.js

### Utility Operations
- `window.electron.memory.export()` - src/services/memory.js, ConversationHistory.jsx
- `window.electron.memory.import(data)` - src/services/memory.js
- `window.electron.memory.getStats()` - src/services/memory.js
- `window.electron.memory.getLocation()` - src/services/memory.js

---

## LocalStorage Keys (Memory-Related)

### User/Session State
- `device_id` - App.jsx, supabase.js
- `user_id` - App.jsx, AppleFloatBar.jsx, many components
- `session_id` - api.js (fallback)
- `onboarding_completed` - App.jsx, OnboardingFlow.jsx
- `user_data` - OnboardingFlow.jsx

### Preferences
- `theme` - useStore.js, CommandPalette.jsx
- `permission_level` - AppleFloatBar.jsx, PermissionContext.jsx, api.js
- `pref_memory_preview` - AppleFloatBar.jsx
- `pref_memory_auto_apply` - AppleFloatBar.jsx
- `pref_memory_review` - AppleFloatBar.jsx
- `pref_memory_debug` - AppleFloatBar.jsx
- `pref_safety_disable_pii` - AppleFloatBar.jsx
- `pref_deep_memory_search` - AppleFloatBar.jsx, SettingsSimple.jsx
- `pref_theme` - SettingsSimple.jsx
- `pref_analytics` - SettingsSimple.jsx

### UI State
- `amx:floatbar:lastHeight` - AppleFloatBar.jsx
- `recent_commands` - CommandPalette.jsx
- `conversationHistory` - useStore.js, SettingsGlass.jsx
- `screenControlEnabled` - Settings.jsx

### Google Integration
- `google_user_email` - AppleFloatBar.jsx, GoogleConnect.jsx, api.js

### Approval/Permissions
- `approval_skip_email_send` - AppleFloatBar.jsx
- `approval_skip_*` (dynamic keys) - ApprovalDialog.jsx

### Billing
- `user_email` - SubscriptionManager.jsx

### API Config
- `api_url` - apiConfig.js
- `api_key` - apiConfig.js (legacy, being removed)

### Telemetry
- `telemetry_enabled` - telemetry.js
- `telemetry_user_id` - telemetry.js

---

## Supabase Table Mapping

| Electron API | Supabase Table | Notes |
|--------------|----------------|-------|
| Profile data | `users` | Store in metadata column |
| Facts | `facts` | Direct mapping |
| Preferences | `preferences` | Direct mapping |
| Sessions | `sessions` | Direct mapping |
| Messages | `messages` | Direct mapping |
| Context | Built from facts/messages/prefs | Computed |

---

## Migration Strategy

1. **Create supabaseMemory.js** wrapper that:
   - Tries Supabase first
   - Falls back to electron.memory when offline
   - Syncs local changes when back online

2. **Keep critical localStorage keys** for:
   - Device/user ID
   - Theme
   - Permission level
   - Offline queue

3. **Migrate in phases**:
   - Phase 1: Facts (least critical)
   - Phase 2: Preferences
   - Phase 3: Profile
   - Phase 4: Sessions/Messages
   - Phase 5: Remove direct electron.memory calls
