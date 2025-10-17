# Compositor Artifact Fix Plan
## The Problem: Shadow/Ghost UI During Resize

**Root Cause:** Chromium/Electron compositor doesn't fully repaint transparent windows during bounds changes, leaving stale frame slices visible. Made worse by backdrop-filter/vibrancy layers.

---

## ✅ Already Tried

### From Previous Diagnosis Docs:
- ✅ Reduced CSS opacity (1% background)
- ✅ Removed CSS backdrop-filter (then re-added)
- ✅ Changed vibrancy modes ('popover' → 'menu' → disabled)
- ✅ Disabled Electron vibrancy completely
- ✅ Fixed input field backgrounds (transparent)
- ✅ Added CSS backdrop-filter for custom blur

### Current State (JUST UPDATED):
- **main.cjs line 57:** `hasShadow: false` ✅ **TEST 1 ACTIVE**
- **main.cjs line 40:** `transparent: true` ✅
- **main.cjs line 54:** `backgroundColor: '#00000000'` ✅
- **main.cjs:** NO vibrancy enabled ✅
- **main.cjs line 235:** instant resize (animate: false) ✅
- **globals.css line 349-356:** Test 3 CSS prepared (not active) 🔧
- **globals.css line 357-358:** backdrop-filter on `::before` pseudo-element ✅ (good - not on root)

---

## ❌ Not Yet Tried - Ranked by Impact/Ease

### **Priority 1: Disable Window Shadow (EASY, 30 seconds)**
**Change:** `hasShadow: true` → `hasShadow: false`
**Location:** `electron/main.cjs` line 57
**Why:** Shadows on transparent windows often glitch during resize
**Risk:** Low - just removes shadow
**Expected:** Reduces or eliminates ghosting

---

### **Priority 2: CSS-Only Animation (MEDIUM, 1-2 hours)**
**Strategy:** Keep window at max size (360x520), animate DOM inside with CSS
**Changes:**
1. Set window to 360x520 on startup (never resize OS window)
2. Use CSS `transform: scale()` + `clip-path` to morph pill → bar → card
3. Use `win.setIgnoreMouseEvents(true, { forward: true })` to ignore clicks outside visible area

**Pros:**
- ✅ Avoids OS-level resize completely (no compositor issues)
- ✅ Smooth CSS animations
- ✅ Electron officially recommends this approach

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Click-through requires careful handling

**Implementation Steps:**
1. Lock window size in `main.cjs` to 360x520
2. Modify FloatBar.jsx to NOT call `resizeWindow()`
3. Add CSS transitions for scale/clip-path
4. Gate clicks with overlay during transitions

---

### **Priority 3: Hide During Resize (EASY, 1 hour)**
**Strategy:** Temporarily hide window, resize instantly, fade back in
**Changes:**
1. Before resize: `mainWindow.setOpacity(0)`
2. Resize with `animate: false` for instant bounds change
3. After resize: `mainWindow.setOpacity(1)` with CSS fade

**Pros:**
- ✅ Simple to implement
- ✅ User never sees the ghosting

**Cons:**
- ⚠️ Brief flicker/fade effect

---

### **Priority 4: Disable Backdrop-Filter During Resize (MEDIUM, 1 hour)**
**Strategy:** Remove blur while resizing, restore after
**Changes:**
1. Add CSS class `.no-blur` that removes backdrop-filter
2. Apply class before resize
3. Remove class after resize completes

**Code:**
```css
.amx-mini.no-blur::before,
.amx-bar.no-blur::before,
.amx-card.no-blur::before {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

**Pros:**
- ✅ Targets the exact layer causing issues

**Cons:**
- ⚠️ Brief moment without blur

---

### **Priority 5: Native Vibrancy Instead of CSS (MEDIUM, 30 min)**
**Strategy:** Use lightest macOS vibrancy ('under-window') instead of CSS blur
**Changes:**
1. Re-enable `vibrancy: 'under-window'` in main.cjs
2. Remove CSS backdrop-filter

**Pros:**
- ✅ Native compositor path (potentially more stable)

**Cons:**
- ❌ Adds gray material tint (already tested, didn't like it)
- ❌ Less control over appearance

**Verdict:** Skip this - you already tried and rejected it

---

### **Priority 6: Two-Window Crossfade (COMPLEX, 3-4 hours)**
**Strategy:** Use separate windows for pill and card, crossfade between them
**Implementation:**
1. Create `pillWindow` (68x68, always visible)
2. Create `cardWindow` (360x520, hidden by default)
3. On expand: show card, fade opacity, hide pill
4. On collapse: show pill, fade, hide card

**Pros:**
- ✅ No mid-animation resizes
- ✅ Safest for transparent windows

**Cons:**
- ❌ Complex state management
- ❌ Two IPC connections
- ❌ Memory overhead

**Verdict:** Last resort - only if everything else fails

---

## Recommended Test Order

### Test 1: Disable Shadow (2 minutes)
```javascript
// electron/main.cjs line 57
hasShadow: false,  // Was: true
```

**Test:** Restart app, resize through modes, check for ghosting.

---

### Test 2: Hide During Resize (if Test 1 fails)
**Implementation:**
1. Add opacity control to main.cjs resize handler
2. Hide → resize instantly → show

---

### Test 3: CSS-Only Animation (if Test 2 fails)
**Implementation:**
1. Lock window size
2. CSS transforms instead of resize

---

## Quick Verification Commands

### Check Window Properties:
```javascript
// In DevTools console:
console.log({
  hasShadow: await window.electron.getBounds(),
  // Check if window is actually resizing
});
```

### Watch for Compositor Issues:
```bash
# macOS Console.app - filter for "windowserver" or "compositor"
# Look for errors during resize
```

---

## Expected Outcome

**Best Case (Test 1):**
- Disabling shadow alone fixes ghosting
- Simple one-line change

**Likely Case (Test 1 + Test 2):**
- Shadow helps but doesn't fully fix
- Hiding during resize eliminates visible artifacts

**Worst Case (Test 3):**
- Need to implement CSS-only animation
- More work but guaranteed to work

---

## Notes

- The backdrop-filter IS on a pseudo-element (good) ✅
- NOT on html/body ✅
- Current vibrancy: DISABLED ✅
- This is a known Electron/Chromium issue with transparent windows and resize
- CSS-only animation is the "nuclear option" that always works
