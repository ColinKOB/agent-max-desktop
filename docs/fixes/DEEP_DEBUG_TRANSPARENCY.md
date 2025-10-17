# Deep Debug: Transparency Issues

## Summary of Investigation

### ✅ What's CORRECT:
1. **CSS Values are correct** - All three modes (.amx-mini, .amx-bar, .amx-card) have:
   - `background: rgba(255, 255, 255, 0.01)` (1% opacity)
   - `backdrop-filter: saturate(200%) blur(50px)`
   - `-webkit-backdrop-filter: saturate(200%) blur(50px)`

2. **macOS Reduced Transparency is OFF** - Verified with `defaults read`

3. **Electron vibrancy set to 'popover'** - Correct for glass effects

4. **No inline styles overriding** - FloatBar.jsx doesn't set inline backdrop styles

5. **Message bubbles are opaque** (as they should be)

---

## 🐛 POTENTIAL ROOT CAUSES

### **Cause #1: Vite CSS Not Hot-Reloading**
**Symptom:** Mini pill not showing changes  
**Why:** Vite may be serving cached CSS

**Test:**
```bash
./force-reload.sh
npm run dev
# New terminal:
npm run electron:dev
```

---

### **Cause #2: Electron Window Not Sampling Desktop**
**Symptom:** Background looks opaque/white instead of blurred desktop  
**Why:** Vibrancy might not be working or window isn't truly transparent

**Test with direct HTML:**
1. Open `test-glass-direct.html` in Chrome browser
2. If it shows glass → CSS works, issue is Electron-specific
3. If no glass → System/browser doesn't support backdrop-filter

---

### **Cause #3: Multiple Layers Stacking Opacity**
**Symptom:** Looks more opaque than expected  
**Why:** `.amx-root` + `.amx-card` + `.amx-panel` might be stacking

**Check in DevTools:**
```javascript
// With app running and DevTools open (line 92 in main.cjs)
document.querySelectorAll('.amx-mini, .amx-card, .amx-bar').forEach(el => {
  const styles = window.getComputedStyle(el);
  console.log(el.className, {
    background: styles.background,
    backdropFilter: styles.backdropFilter,
    webkitBackdropFilter: styles.webkitBackdropFilter
  });
});
```

---

### **Cause #4: Border Creating Visual Opacity**
**Line 351, 519, 603:**
```css
border: 1px solid rgba(255, 255, 255, 0.6);  /* 60% white border */
```

This bright border might make the whole thing LOOK more opaque.

**Test:** Temporarily reduce border opacity:
```css
border: 1px solid rgba(255, 255, 255, 0.2);  /* 20% white border */
```

---

### **Cause #5: Inner Box Shadow Adding Whiteness**
**Line 353, 521, 605:**
```css
box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.8);  /* 80% white glow */
```

This inner highlight might be adding perceived opacity.

**Test:** Remove it:
```css
box-shadow: none;
```

---

### **Cause #6: Electron Compositor Issue**
**Symptom:** Everything correct but still looks opaque  
**Why:** Electron's compositor might not be rendering backdrop-filter correctly

**Test vibrancy alternatives:**
```javascript
// In electron/main.cjs line 52, try different modes:
vibrancy: 'hud',        // HUD-style glass
vibrancy: 'window',     // Window-style glass
vibrancy: 'menu',       // Menu-style glass
vibrancy: 'under-page', // Under-page glass
```

---

## 🔬 SYSTEMATIC DEBUG PROCEDURE

### **Step 1: Verify CSS is Loading**
```bash
# Run force reload
./force-reload.sh
npm run dev
npm run electron:dev
```

In DevTools Console:
```javascript
// Check if styles are computed
const mini = document.querySelector('.amx-mini');
if (mini) {
  console.log('MINI STYLES:', window.getComputedStyle(mini).backdropFilter);
}
```

**Expected:** `saturate(200%) blur(50px)`  
**If different:** CSS not loading correctly

---

### **Step 2: Test Pure HTML Glass**
```bash
# Open test file in regular Chrome (not Electron)
open test-glass-direct.html
```

**If glass works in Chrome but not Electron:**
→ Electron-specific issue (vibrancy/transparency)

**If glass doesn't work anywhere:**
→ System doesn't support backdrop-filter (unlikely on modern macOS)

---

### **Step 3: Remove Visual Elements**
Temporarily simplify to isolate the issue:

```css
/* In globals.css, temporarily change mini pill: */
.amx-mini {
  background: rgba(255, 0, 0, 0.01);  /* 1% RED for testing */
  backdrop-filter: saturate(200%) blur(50px);
  -webkit-backdrop-filter: saturate(200%) blur(50px);
  border: 1px solid red;  /* Red border to see it clearly */
  box-shadow: none;  /* Remove inner glow */
}
```

**If you see RED tint:** CSS is loading  
**If you see no change:** CSS not reloading

---

### **Step 4: Test Minimal Case**
Create minimal Electron window:

```javascript
// Add to electron/main.cjs for testing
function createTestWindow() {
  const testWin = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    vibrancy: 'popover',
    frame: false,
  });
  
  testWin.loadURL('data:text/html,<body style="margin:0;background:transparent;"><div style="width:200px;height:200px;background:rgba(255,255,255,0.01);backdrop-filter:blur(50px);-webkit-backdrop-filter:blur(50px);border:1px solid white;border-radius:16px;margin:50px;">TEST</div></body>');
}

// Call it: createTestWindow();
```

**If test window shows glass:** Main app has additional blocker  
**If test window doesn't show glass:** Electron configuration issue

---

## 🎯 MOST LIKELY SOLUTIONS

### **Solution A: Border/Shadow Making It Look Opaque**

The bright white border (60%) and inner shadow (80%) might be creating visual opacity:

```css
.amx-mini, .amx-bar, .amx-card {
  border: 1px solid rgba(255, 255, 255, 0.15);  /* Reduce from 0.6 to 0.15 */
  box-shadow: none;  /* Remove inner highlight */
}
```

---

### **Solution B: CSS Not Reloading**

Force complete cache clear:
```bash
chmod +x force-reload.sh
./force-reload.sh
```

Then restart both dev server AND Electron.

---

### **Solution C: Try Different Vibrancy**

```javascript
// electron/main.cjs line 52
vibrancy: 'hud',  // Try this instead of 'popover'
```

HUD mode is designed for transparent overlays.

---

## 📊 DEBUGGING CHECKLIST

Run through this checklist:

- [ ] Ran `./force-reload.sh` to clear all caches
- [ ] Opened DevTools and checked computed styles show `blur(50px)`
- [ ] Tested `test-glass-direct.html` in Chrome (works = CSS good)
- [ ] Reduced border opacity to 0.15
- [ ] Removed box-shadow inner highlight
- [ ] Tried different vibrancy modes (hud, window, menu)
- [ ] Checked Electron logs for vibrancy errors
- [ ] Verified macOS version supports backdrop-filter (10.14+)
- [ ] Checked GPU acceleration is enabled in Electron

---

## 🚨 IF NOTHING WORKS

If all else fails, the issue might be:

1. **Electron version bug** - Update to latest Electron
2. **macOS compositor bug** - Try on different macOS version
3. **GPU driver issue** - backdrop-filter requires GPU acceleration

**Nuclear option:** Use native Electron vibrancy only (no CSS backdrop-filter):
```javascript
// This relies purely on Electron, not CSS
vibrancy: 'popover',
backgroundColor: undefined,  // Let vibrancy handle it
```

Then remove backdrop-filter from CSS entirely.
