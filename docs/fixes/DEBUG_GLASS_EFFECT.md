# Glass Effect Debugging Guide

## Changes Made

### 1. Fixed CSS backdrop-filter sync (globals.css line 347-348)
```css
backdrop-filter: saturate(140%) blur(30px);
-webkit-backdrop-filter: saturate(140%) blur(30px);  /* NOW SYNCED */
```
**Issue**: Was `blur(5px)` which broke the glass effect

### 2. Changed Electron vibrancy setting (main.cjs line 52)
```javascript
vibrancy: 'popover',  // Changed from 'under-window'
```
**Reason**: 'popover' is designed for floating glass panels and works better with backdrop-filter

### 3. Enabled DevTools for inspection (main.cjs line 92)
```javascript
mainWindow.webContents.openDevTools({ mode: 'detach' });
```

---

## Testing Steps

### Step 1: Complete Restart
```bash
# Kill all instances
pkill -f "Electron"
pkill -f "agent-max"

# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

### Step 2: Start Electron App
```bash
# In a NEW terminal window
npm run electron:dev
```

### Step 3: Inspect in DevTools

When the app opens with DevTools:

1. **Select the mini pill element**
   - Click the element picker (top-left of DevTools)
   - Click on the mini pill window

2. **Check computed styles**
   - Look for `.amx-mini` or `.amx-card`
   - Verify these properties:
     ```
     backdrop-filter: saturate(140%) blur(30px)
     -webkit-backdrop-filter: saturate(140%) blur(30px)
     background: rgba(255, 255, 255, 0.08)
     ```

3. **Test backdrop-filter support**
   - In Console tab, run:
     ```javascript
     CSS.supports('backdrop-filter', 'blur(30px)')
     CSS.supports('-webkit-backdrop-filter', 'blur(30px)')
     ```
   - Both should return `true`

4. **Check if styles are being overridden**
   - In Styles panel, look for strikethrough styles
   - Check if any other CSS is overriding the glass effect

---

## Expected Result

You should see:
- **Transparent frosted glass** with desktop visible through it
- **Sanded/frosted appearance** (not opaque white)
- **Slight blur** making desktop content behind unreadable
- **Color saturation** from desktop showing through

---

## If Still Opaque White

### Checklist:

- [ ] **macOS System Settings**
  - Go to: System Preferences → Accessibility → Display
  - Ensure **"Reduce transparency"** is OFF
  
- [ ] **Hard Reload**
  - Press `Cmd+Shift+R` in DevTools
  - Or quit and restart Electron completely

- [ ] **Check CSS Loading**
  - In DevTools Network tab, verify `globals.css` loaded
  - Check if there are any CSS errors in Console

- [ ] **Vibrancy Working**
  - In Console, run:
    ```javascript
    window.process?.platform
    ```
  - Should return "darwin" (macOS)

- [ ] **Try Different Vibrancy**
  - Edit `electron/main.cjs` line 52
  - Try: `'hud'`, `'window'`, or `'menu'`
  - Restart Electron

---

## Alternative: Test with Pure HTML

Create `test-glass.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      background: transparent;
    }
    .glass {
      width: 200px;
      height: 200px;
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: saturate(140%) blur(30px);
      -webkit-backdrop-filter: saturate(140%) blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 16px;
    }
  </style>
</head>
<body>
  <div class="glass">Glass Effect Test</div>
</body>
</html>
```

Load this in Electron - if it shows glass, the CSS works. If not, it's an Electron/system issue.

---

## Diagnostic Commands

Run these in DevTools Console:

```javascript
// Check if backdrop-filter is computed
getComputedStyle(document.querySelector('.amx-mini'))['backdrop-filter']

// Check if vibrancy is working
window.chrome

// Check Electron version
process.versions.electron

// Force repaint
document.body.style.display='none';
document.body.offsetHeight;
document.body.style.display='';
```

---

## If Nothing Works

The issue might be:

1. **macOS version incompatibility** - Vibrancy requires macOS 10.10+
2. **GPU acceleration disabled** - backdrop-filter needs GPU
3. **Electron compositor bug** - Try updating Electron version
4. **System graphics settings** - Check Energy Saver settings

### Last Resort: Different Approach

If backdrop-filter refuses to work, we can use:
- Native Electron vibrancy without CSS backdrop-filter
- Or increase background opacity to `rgba(255, 255, 255, 0.85)` for opaque white
