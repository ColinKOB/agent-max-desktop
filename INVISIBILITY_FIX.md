# INVISIBILITY FIX - App Disappearing Issue

## The Problem

**You see:** White pill (mini mode) ✅  
**You click it:** Bar mode appears but is INVISIBLE ❌

**Root Cause:** Background opacity was TOO LOW (2-5%) - the app became invisible!

---

## ✅ Fix Applied

Changed background opacity from **5% → 15%** across all modes:

```css
/* BEFORE (INVISIBLE): */
background: rgba(255, 255, 255, 0.05);  /* 5% - TOO transparent */

/* AFTER (VISIBLE): */
background: rgba(255, 255, 255, 0.15);  /* 15% - visible white */
```

---

## 🚨 RESTART REQUIRED

**Critical:** You MUST restart Electron for this to work!

```bash
# Kill Electron completely
pkill -9 -f Electron

# Restart (Vite should still be running)
npm run electron:dev
```

---

## 👀 What You Should See Now

### **Mini Mode (68×68 pill):**
- ✅ White rounded square
- ✅ Agent Max logo visible
- ✅ 6 dots (drag handle)

### **Bar Mode (When you click mini):**
- ✅ Should now be VISIBLE as white bar
- ✅ Input field "Ask MAX..."
- ✅ Minimize button on right

### **Card Mode (When you type/focus):**
- ✅ Should be VISIBLE as white panel
- ✅ Full chat interface
- ✅ All UI elements visible

---

## Why This Happened

We were trying to achieve "perfect transparency" by reducing opacity:
- 28% → 8% → 2% → 1% → 5%

But without macOS vibrancy blur, **low opacity = invisible!**

The blur effect gives visual substance. Without it, you need more opacity to see the window.

---

## Current Settings

```javascript
// electron/main.cjs
transparent: true,
// vibrancy: 'menu',  // DISABLED (no gray material)
```

```css
/* globals.css */
background: rgba(255, 255, 255, 0.15);  /* 15% white */
backdrop-filter: blur(20px) saturate(1.3);  /* CSS blur */
border: 1px solid rgba(255, 255, 255, 0.5);  /* Strong border */
```

---

## Expected Result

**15% white opacity** means:
- ✅ Window is clearly visible
- ✅ Desktop shows through (transparent)
- ✅ No gray vibrancy material
- ✅ White/frosted appearance
- ✅ All UI elements readable

**Trade-off:** Less transparent than we wanted, but actually visible!

---

## If Still Invisible After Restart

### **Option 1: Increase Opacity More**

Edit `src/styles/globals.css` - change all three locations:

```css
/* Make it even MORE visible: */
background: rgba(255, 255, 255, 0.25);  /* 25% - very visible */
```

### **Option 2: Add Background Color**

```css
/* Add slight color for better visibility: */
background: rgba(240, 240, 245, 0.20);  /* Light blue-white */
```

### **Option 3: Re-enable Minimal Vibrancy**

In `electron/main.cjs`:

```javascript
// Uncomment:
vibrancy: 'under-window',  // Minimal native blur
```

This adds slight blur AND visibility without heavy gray.

---

## Testing Checklist

After restart:

- [ ] Mini pill is visible (white square)
- [ ] Click mini pill
- [ ] Bar mode appears and is VISIBLE (not invisible!)
- [ ] Can see input field "Ask MAX..."
- [ ] Can see minimize button
- [ ] Type something
- [ ] Card mode expands and is VISIBLE
- [ ] All text is readable

---

## Summary

**Problem:** 5% opacity made bar/card modes invisible  
**Solution:** Increased to 15% opacity  
**Action:** Restart Electron to see changes  
**Result:** Visible white glass windows on transparent background
