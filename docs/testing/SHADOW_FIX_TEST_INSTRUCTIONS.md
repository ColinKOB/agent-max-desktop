# Shadow/Ghosting Fix - Test Instructions

## What Was Changed

### ✅ Test 1: ACTIVE - Disable Window Shadow
**File:** `electron/main.cjs` line 57
**Change:** `hasShadow: true` → `hasShadow: false`

This is the most common fix for compositor artifacts on transparent windows during resize.

### 🔧 Test 2: READY (commented out)
**File:** `electron/main.cjs` lines 228-242
**What:** Hide window → instant resize → fade back in
**To Enable:** Uncomment the lines if Test 1 doesn't work

### 🔧 Test 3: READY (CSS prepared)
**File:** `src/styles/globals.css` lines 349-356
**What:** Disable backdrop-filter during resize
**To Enable:** Add `amx-no-blur` class to FloatBar.jsx alongside `amx-transitioning`

---

## How to Test

### Step 1: Restart the App
```bash
# Kill all Electron processes
pkill -9 -f Electron

# Start fresh with Test 1 active
npm run dev

# In another terminal:
npm run electron:dev
```

### Step 2: Test Resize Transitions
1. **Start in mini mode** (68x68 pill)
2. **Click to expand to bar** (320x68 horizontal)
3. **Type something and press Enter** (expands to 360x520 card)
4. **Click minimize** (back to pill)

### Step 3: Look for Ghosting
**What to watch for:**
- ❌ Old UI shadow/ghost at top during transitions
- ❌ Stale frame artifacts
- ❌ Blurry duplicates of previous size

**Expected with Test 1:**
- ✅ Clean transitions with no ghosting
- ✅ Smooth resize without artifacts

---

## If Test 1 Doesn't Fix It

### Enable Test 2 (Hide During Resize)
1. Edit `electron/main.cjs` lines 228-242
2. Uncomment the opacity lines:
```javascript
const wasVisible = mainWindow.isVisible();
if (wasVisible) {
  mainWindow.setOpacity(0); // Hide window
}
// ... resize happens ...
if (wasVisible) {
  setTimeout(() => {
    mainWindow.setOpacity(1); // Fade back in
  }, 16);
}
```
3. Restart and test again

### Enable Test 3 (No Blur During Resize)
1. Edit `src/components/FloatBar.jsx` line 154
2. Change:
```javascript
setIsTransitioning(true);
```
to:
```javascript
setIsTransitioning(true);
setIsNoBlur(true); // Add this
```
3. Add state at top of component:
```javascript
const [isNoBlur, setIsNoBlur] = useState(false);
```
4. Update the className in lines 935, 965, 1007:
```javascript
className={`amx-root amx-mini ${isTransitioning ? 'amx-transitioning' : ''} ${isNoBlur ? 'amx-no-blur' : ''}`}
```
5. Clear the flag in line 179:
```javascript
} finally {
  finishTransition();
  setIsNoBlur(false); // Add this
}
```

---

## Debugging

### Check if hasShadow is Actually Disabled
```javascript
// In DevTools console (after app loads):
const { BrowserWindow } = require('@electron/remote');
const win = BrowserWindow.getFocusedWindow();
console.log('Has shadow:', win.hasShadow());
```

### Watch for Resize Events
Open DevTools and watch the console during transitions. You should see:
```
[Electron] Resizing window to 320x68
[Electron] Before resize: {x: ..., y: ..., width: 68, height: 68}
[Electron] After resize: {x: ..., y: ..., width: 320, height: 68}
```

---

## Expected Results

### Best Case (Test 1 works)
- ✅ No ghosting after disabling shadow
- ✅ Clean, smooth transitions
- ✅ One-line fix, no complexity

### Good Case (Test 1 + Test 2)
- ✅ Brief fade during resize (barely noticeable)
- ✅ No visible ghosting artifacts
- ✅ Simple implementation

### Acceptable Case (Test 1 + Test 2 + Test 3)
- ✅ No blur during transition (flash of un-blurred state)
- ✅ No ghosting
- ⚠️ Slightly less polished transition

### Last Resort (CSS-Only Animation)
If all three tests fail, we'll implement the CSS-only approach (see COMPOSITOR_ARTIFACT_FIX_PLAN.md Priority 2)

---

## What You've Already Tried (From Previous Sessions)

✅ Vibrancy disabled
✅ Transparent window enabled
✅ Background opacity at 1-2%
✅ CSS backdrop-filter tested
✅ Input backgrounds fixed
✅ Multiple vibrancy modes tried

## What This Fixes

❌ The compositor artifact issue (stale frames during resize)
✅ Known Electron/Chromium limitation with transparent windows
✅ Specifically affects frameless transparent windows during bounds changes
✅ Made worse by backdrop-filter (which you need for the glass effect)

---

## Quick Status Check

**Current Setup:**
- Window: transparent, frameless, no vibrancy
- Shadow: **DISABLED** (Test 1 active)
- Resize: instant (no animation)
- Backdrop-filter: on ::before pseudo-elements (good placement)

**This should work!** The shadow is the most common culprit for this exact issue.
