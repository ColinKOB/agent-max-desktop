# Quick Reference: What Changed

## ✅ Active Changes (Test 1)

### File: `electron/main.cjs`

**Line 57:**
```javascript
// BEFORE:
hasShadow: true,

// AFTER:
hasShadow: false,  // Disabled - shadows on transparent windows cause compositor artifacts during resize
```

**Line 235:**
```javascript
// BEFORE:
mainWindow.setSize(width, height);

// AFTER:
mainWindow.setSize(width, height, false); // false = no animation (instant)
```

---

## 🔧 Prepared But Not Active (Test 2)

### File: `electron/main.cjs`

**Lines 228-242:** Ready to uncomment if needed
```javascript
// TEST 2: HIDE DURING RESIZE (currently disabled)
// Uncomment these lines if hasShadow:false doesn't fix ghosting
// const wasVisible = mainWindow.isVisible();
// if (wasVisible) {
//   mainWindow.setOpacity(0); // Hide window
// }

mainWindow.setSize(width, height, false);

// TEST 2: RESTORE VISIBILITY (currently disabled)
// if (wasVisible) {
//   setTimeout(() => {
//     mainWindow.setOpacity(1); // Fade back in
//   }, 16); // Wait one frame
// }
```

---

## 🔧 Prepared But Not Active (Test 3)

### File: `src/styles/globals.css`

**Lines 349-356:** CSS class created
```css
/* TEST 3: Disable backdrop-filter during resize (currently not applied) */
/* To enable: Add 'amx-no-blur' class alongside 'amx-transitioning' in FloatBar.jsx */
.amx-no-blur.amx-mini::before,
.amx-no-blur.amx-bar::before,
.amx-no-blur.amx-card::before {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

---

## How to Enable Test 2 (If Needed)

1. Open `electron/main.cjs`
2. Find lines 228-242
3. Remove the `//` from these 6 lines:
   - Line 230: `const wasVisible = mainWindow.isVisible();`
   - Line 231: `if (wasVisible) {`
   - Line 232: `mainWindow.setOpacity(0);`
   - Line 233: `}`
   - Lines 238-241: The entire setTimeout block

---

## How to Enable Test 3 (If Needed)

See detailed instructions in: `SHADOW_FIX_TEST_INSTRUCTIONS.md` (lines 63-88)

---

## What This Fixes

**Problem:** 
```
During resize (pill → bar → card), you see:
- Old UI shadow/ghost at top
- Stale frame artifacts  
- Compositor not repainting fully
```

**Solution:**
```
Test 1: Remove shadow (most common fix)
Test 2: Hide during resize (if Test 1 not enough)
Test 3: Remove blur during resize (last CSS approach)
```

---

## Verification

After restarting the app, test these transitions:
1. **Mini (68×68) → Bar (320×68)** - Click the pill
2. **Bar → Card (360×520)** - Type and press Enter
3. **Card → Mini** - Click minimize button

**Look for:** Clean transitions with NO ghosting/shadow artifacts

---

## Rollback (If Needed)

To undo Test 1:
```javascript
// electron/main.cjs line 57
hasShadow: true,  // Back to original
```

To undo instant resize:
```javascript
// electron/main.cjs line 235
mainWindow.setSize(width, height);  // Remove the 'false'
```
