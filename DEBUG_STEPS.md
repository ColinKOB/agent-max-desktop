# Debugging Steps - "It Didn't Work"

## What Specifically Didn't Work?

Please check and tell me:

### **1. Is it still gray?**
- [ ] YES - Still has gray/frosted appearance
- [ ] NO - Desktop is visible but something else is wrong

### **2. Is the memory error still happening?**
- [ ] YES - Still shows "String value is required" error
- [ ] NO - Welcome screen saves correctly

### **3. Is there any blur at all?**
- [ ] YES - Desktop is blurred
- [ ] NO - Desktop is sharp/clear
- [ ] N/A - Can't tell because still gray

---

## Step-by-Step Debugging

### **Step 1: Confirm Changes Are Loaded**

1. Open the app
2. Press **Cmd+Option+I** to open DevTools
3. Go to **Console** tab
4. Copy/paste this and press Enter:

```javascript
// Check if vibrancy is disabled
console.log('Vibrancy disabled:', !window.require); 

// Check CSS backdrop-filter
const card = document.querySelector('.amx-card');
if (card) {
  const styles = window.getComputedStyle(card);
  console.log('Background:', styles.background);
  console.log('Backdrop Filter:', styles.backdropFilter || styles.webkitBackdropFilter);
} else {
  console.log('No .amx-card found');
}
```

**Expected output:**
```
Background: rgba(255, 255, 255, 0.02)
Backdrop Filter: blur(20px) saturate(1.3)
```

---

### **Step 2: Run Full Diagnostic**

In DevTools Console, copy/paste the entire contents of `debug-transparency.js` and press Enter.

This will show you:
- Which elements have backgrounds
- If backdrop-filter is working
- What's causing the gray

---

### **Step 3: Check Electron Settings**

1. In your terminal where Electron is running
2. Look for any errors or warnings
3. Check if it says "vibrancy" anywhere

---

### **Step 4: Hard Reset**

```bash
# Stop everything
pkill -9 -f "Electron|node"

# Clear ALL caches
rm -rf node_modules/.vite
rm -rf .vite
rm -rf dist
rm -rf ~/Library/Application\ Support/agent-max-desktop

# Restart
npm run dev
# New terminal:
npm run electron:dev
```

---

## Common Issues & Fixes

### **Issue A: Still Gray (Vibrancy Not Actually Disabled)**

**Check:** Is vibrancy actually commented out in `electron/main.cjs`?

```javascript
// Should look like this:
// vibrancy: 'menu',  // ← COMMENTED OUT
// visualEffectState: 'active',  // ← COMMENTED OUT
```

**If not commented:** Add `//` at the start of those lines

---

### **Issue B: Changes Not Loading (Cache)**

**Symptoms:** Code changes aren't appearing

**Fix:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite .vite

# Restart dev server
npm run dev
```

---

### **Issue C: CSS Backdrop-Filter Not Working**

**Symptoms:** Desktop visible but NOT blurred

**This is normal!** CSS `backdrop-filter` often doesn't work in Electron.

**Options:**
1. Keep it transparent without blur (clean look)
2. Re-enable minimal vibrancy (but will have slight gray):
   ```javascript
   vibrancy: 'under-window',
   ```

---

### **Issue D: Memory Error Still Happening**

**Check:** Is `electron/preload.cjs` line 26 correct?

```javascript
// Should be:
setName: (name) => ipcRenderer.invoke('memory:set-name', { name }),
//                                                        ^^^^^^^^ 
//                                                        Must be object!
```

**Test:** Enter name in welcome screen and click Complete Setup

---

## What to Tell Me

After running the diagnostics, please tell me:

1. **From DevTools Console:**
   - What does the background show?
   - What does backdrop-filter show?
   - What does the diagnostic table show?

2. **Visual appearance:**
   - Gray? Clear? Blurred? Sharp?

3. **Memory error:**
   - Still happening? Fixed?

4. **Any error messages:**
   - In DevTools Console
   - In Terminal where Electron is running

---

## Quick Visual Tests

### **Test 1: Is it transparent at all?**
- Move app window over different desktop backgrounds
- Can you see ANY difference behind it?
- If NO → Not transparent (major issue)
- If YES → Partially working

### **Test 2: Is backdrop-filter working?**
- Look at desktop through the app
- Is it blurred or sharp?
- If BLURRED → CSS works! ✅
- If SHARP → CSS doesn't work (normal in Electron)

### **Test 3: What color is it?**
- Pure gray (like frosted glass) → Vibrancy still enabled
- Clear with slight white tint → Vibrancy disabled ✅
- Solid gray → Not transparent at all

---

## Expected Final State

**Perfect outcome:**
- ✅ Desktop clearly visible (not gray)
- ✅ Either blurred (CSS works) OR sharp (CSS doesn't work, both OK)
- ✅ No "String value is required" error
- ✅ Slight white tint (2%) but mostly see-through

**Acceptable outcome:**
- ✅ Desktop clearly visible
- ✅ Sharp (no blur)
- ✅ No memory error
- ❌ But still has SLIGHT gray tint

---

## Last Resort: Pure Transparency (No Effects)

If nothing works, try the absolutely minimal approach:

```javascript
// electron/main.cjs - REMOVE vibrancy completely
transparent: true,
backgroundColor: '#00000000',
// NO vibrancy line at all
```

```css
/* globals.css - REMOVE all effects */
background: transparent;  /* Nothing */
/* NO backdrop-filter */
border: 1px solid rgba(255, 255, 255, 0.5);
```

This will give you pure, clean transparency with zero effects.
