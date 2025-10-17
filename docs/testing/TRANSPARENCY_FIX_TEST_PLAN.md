# Transparency Fix Test Plan

## Changes Applied

### ✅ **1. Disabled macOS Vibrancy**
```javascript
// electron/main.cjs
// vibrancy: 'menu',  // DISABLED - testing pure transparency
// visualEffectState: 'active',  // DISABLED
```

**Purpose:** Remove the gray material effect that macOS vibrancy adds

---

### ✅ **2. Added CSS Backdrop-Filter**
```css
/* globals.css - All modes (mini, bar, card) */
background: rgba(255, 255, 255, 0.02);  /* 2% white tint */
backdrop-filter: blur(20px) saturate(1.3);  /* CSS blur */
-webkit-backdrop-filter: blur(20px) saturate(1.3);
```

**Purpose:** Add blur effect using CSS instead of native macOS vibrancy

---

### ✅ **3. Fixed Memory Error**
```javascript
// electron/preload.cjs line 26
// OLD (BROKEN):
setName: (name) => ipcRenderer.invoke('memory:set-name', name),

// NEW (FIXED):
setName: (name) => ipcRenderer.invoke('memory:set-name', { name }),
```

**Purpose:** Fix "String value is required" error by passing object format the IPC handler expects

---

## Test Procedure

### **Step 1: Complete Restart**
```bash
# Kill ALL Electron processes
pkill -9 -f Electron

# Clear any caches
rm -rf node_modules/.vite
rm -rf .vite

# Start fresh
npm run dev

# New terminal:
npm run electron:dev
```

---

### **Step 2: Test Transparency**

#### **What to Check:**

1. **Desktop Visibility:**
   - ✅ Can you see your desktop/wallpaper through the app?
   - ✅ Is it blurred (from CSS backdrop-filter)?
   - ✅ Is there NO gray tint?

2. **CSS Backdrop-Filter Working:**
   - If YES → Desktop is blurred = CSS blur works in Electron!
   - If NO → Desktop is sharp = CSS blur doesn't work in Electron

3. **No Gray Material:**
   - Without vibrancy, there should be NO gray tinting
   - Desktop colors should look normal (just blurred)

---

### **Step 3: Test Welcome Screen**

1. **Click through the welcome flow**
2. **Enter your name** in step 1
3. **Select options** for role, use, style
4. **Click "Complete Setup"**

**Expected:**
- ✅ NO error about "String value is required"
- ✅ Shows "Welcome, [Your Name]" toast
- ✅ Successfully saves preferences

---

## Possible Outcomes

### **Outcome A: Perfect (CSS Blur Works)**
- ✅ Desktop visible and BLURRED
- ✅ NO gray tint
- ✅ Welcome screen saves without errors

**Action:** We're done! CSS backdrop-filter works without vibrancy

---

### **Outcome B: No Blur (CSS Doesn't Work)**
- ✅ Desktop visible but SHARP (no blur)
- ✅ NO gray tint
- ✅ Welcome screen saves without errors

**Action:** CSS backdrop-filter doesn't work in Electron. Options:
1. Keep it sharp (no blur but clean transparency)
2. Re-enable lightest vibrancy (`'under-window'`)
3. Try different CSS blur values

---

### **Outcome C: Still Gray (Something Else)**
- ❌ Still has gray appearance
- Even without vibrancy

**Action:** There's another source of gray:
1. Check DevTools for inherited styles
2. Check if Electron has other window settings
3. Check if CSS backdrop-filter is adding tint

---

## Debugging Commands

### **Check if backdrop-filter is working:**
```javascript
// In DevTools console:
const card = document.querySelector('.amx-card');
const styles = window.getComputedStyle(card);
console.log('Backdrop:', styles.backdropFilter);
console.log('Webkit Backdrop:', styles.webkitBackdropFilter);
console.log('Background:', styles.background);
```

### **Check Electron window properties:**
```javascript
// In main process (add to main.cjs temporarily):
console.log('Window Config:', {
  transparent: mainWindow.isAlwaysOnTop(),
  backgroundColor: mainWindow.getBackgroundColor(),
  vibrancy: mainWindow.getVibrancy?.() || 'none'
});
```

---

## If CSS Backdrop-Filter Doesn't Work

### **Option 1: Accept No Blur**
```css
/* Clean transparency without blur */
background: rgba(255, 255, 255, 0.02);
/* NO backdrop-filter */
```

### **Option 2: Try Minimal Vibrancy**
```javascript
// electron/main.cjs
vibrancy: 'under-window',  // Absolute minimum blur/material
```

### **Option 3: Try Different CSS Blur**
```css
/* Try different values */
backdrop-filter: blur(10px);  /* Less blur */
backdrop-filter: blur(30px);  /* More blur */
backdrop-filter: blur(15px) brightness(1.05);  /* With brightness */
```

---

## Current Status Summary

### **What We Fixed:**
1. ✅ **Removed vibrancy** - No more gray material effect
2. ✅ **Added CSS blur** - Testing if it works in Electron
3. ✅ **Fixed memory error** - Welcome screen should save

### **What We're Testing:**
1. Does CSS `backdrop-filter` work in Electron without vibrancy?
2. Is the gray completely gone?
3. Does the welcome flow work without errors?

---

## Expected Final Result

If everything works:
- ✅ **Desktop clearly visible** through the app
- ✅ **Blurred background** (from CSS)
- ✅ **NO gray tint** (vibrancy disabled)
- ✅ **Welcome screen saves** without errors
- ✅ **True glass transparency** achieved!

---

## Notes

- **CSS backdrop-filter may not work** in Electron due to security/renderer limitations
- If it doesn't work, we have to choose: sharp transparency OR vibrancy with gray
- The memory error is definitely fixed (wrong parameter format)
- Test with different desktop backgrounds to verify transparency
