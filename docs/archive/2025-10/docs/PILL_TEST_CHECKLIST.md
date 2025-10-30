# Pill Window Test Checklist
**Session:** Oct 17, 2025 9:24 AM  
**Commit:** `ffe35ef`  
**Status:** CSS cache issue blocking glass tint validation

---

## 🎯 Current Issues

### Issue 1: Old CSS Still Loading
**Symptom:**
```javascript
getComputedStyle(document.querySelector('.amx-mini'), '::before').background
// Returns: rgba(255, 255, 255, 0.12) ❌ (old white tint)
// Expected: rgba(16, 19, 32, 0.32) ✅ (new dark tint)
```

**Fix:** Hard reload to bust cache.

### Issue 2: Pill Not Draggable
**Symptom:** Can't drag pill window (except via 6-dot handle)  
**Cause:** `.amx-mini-draggable` set to `no-drag` to allow clicks  
**Status:** Intentional trade-off; dedicated drag surface coming next

---

## ✅ Step-by-Step Validation

### Step 1: Force CSS Reload
1. **Stop the app** (`Ctrl+C` in terminal)
2. **Clear Electron cache:**
   ```bash
   rm -rf ~/Library/Application\ Support/agent-max-desktop/Cache
   rm -rf ~/Library/Application\ Support/agent-max-desktop/Code\ Cache
   ```
3. **Restart:**
   ```bash
   npm run electron:dev
   ```
4. **Hard reload in DevTools:** `Cmd+Shift+R` in the pill window

---

### Step 2: Verify Stylesheet Loading
Open DevTools Console in pill window:

```javascript
// 1. List active stylesheets
[...document.styleSheets].map(s => s.href || '(inline)')
```

**Expected output:**
```javascript
[
  "http://localhost:5174/src/main.jsx",
  "http://localhost:5174/src/styles/globals.css",  // ← Must be present
  "http://localhost:5174/src/styles/liquid-glass.css"
]
```

**If `globals.css` is missing:**
- Check that `src/main.jsx` imports it
- Verify Vite dev server is running (port 5174)
- Check for build errors in terminal

---

### Step 3: Verify Dark Glass Tint
```javascript
// 2. Check computed background
const mini = document.querySelector('.amx-mini');
const bg = getComputedStyle(mini, '::before').background;
console.log(bg);
```

**Expected output (contains):**
```
rgba(16, 19, 32, 0.32)  // ← Dark base layer
```

**If still showing old white tint:**
```javascript
// Force style update (temporary)
const style = document.createElement('style');
style.textContent = `
.amx-mini::before {
  background:
    radial-gradient(160% 200% at 22% -28%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.05) 55%, rgba(255, 255, 255, 0) 80%),
    linear-gradient(148deg, rgba(112, 146, 255, 0.16), rgba(142, 96, 255, 0.12), rgba(255, 172, 116, 0.07)),
    rgba(16, 19, 32, 0.32) !important;
}
`;
document.head.appendChild(style);
```

Take a screenshot. If the dark tint looks correct, the issue is CSS bundling/caching.

---

### Step 4: Visual Inspection
**What to look for:**
- [ ] Pill background is **dark translucent**, not opaque white
- [ ] Desktop wallpaper **blurs through** the pill
- [ ] Logo (AgentMaxLogo.png) is **visible and centered**
- [ ] Subtle **rim light** at top edge (white gradient)
- [ ] Soft **blue/purple chroma** hints in background
- [ ] **Border:** 1px solid white/22% opacity
- [ ] **Shadow:** Visible drop shadow below pill

**Take a screenshot** and compare to previous white square image.

---

### Step 5: Interaction Tests

#### A. Click Logo (Expand)
```javascript
// Should log expansion
document.querySelector('.amx-mini-logo').click()
// Check console for: "[FloatBar] Mini clicked: Opening to bar mode"
```

**Expected:** Pill expands to horizontal bar (320×68)  
**If fails:** Check React onClick handler in FloatBar.jsx line 1994

#### B. Drag 6-Dot Handle (Move Window)
- **Action:** Click and drag the bottom-left 6-dot grid
- **Expected:** Window moves across screen
- **CSS:** `.amx-drag-handle-mini { -webkit-app-region: drag }`

#### C. Drag Anywhere Else
- **Action:** Click/drag empty space on pill
- **Current:** ❌ Won't drag (by design)
- **Next Fix:** Add dedicated drag surface

---

## 🐛 Known Issues

### 1. **CSS Cache Persists After Restart**
**Workaround:**
```bash
# Nuclear option: delete all Electron data
rm -rf ~/Library/Application\ Support/agent-max-desktop
npm run electron:dev
```

### 2. **Hot Reload Doesn't Update ::before Styles**
**Workaround:** Hard reload (`Cmd+Shift+R`) in DevTools

### 3. **Temporary Debugging Code Still Active**
**Items to remove later:**
- `electron/main.cjs` line 55: `resizable: true`
- `electron/main.cjs` line 82-84: Auto-open DevTools
- `FloatBar.jsx` line 77-84: Auto-expand effect

---

## 📊 Success Criteria

- [x] **DOM renders** — `.amx-root .amx-mini` classes present
- [x] **Logo present** — `document.querySelector('.amx-mini-logo')` exists
- [x] **No runtime errors** — `process.env` crash fixed
- [ ] **Dark tint loads** — `rgba(16,19,32,0.32)` in computed styles
- [ ] **Translucent appearance** — Desktop visible through blur
- [ ] **Logo clickable** — Expands to bar mode
- [ ] **Drag handle works** — 6-dot grid moves window

---

## 🔧 Next Actions

### If Dark Tint Still Not Loading:
1. **Check Vite build output** in terminal for CSS errors
2. **Inspect `main.jsx`** — verify `import './styles/globals.css'`
3. **Check file timestamps:**
   ```bash
   ls -la src/styles/globals.css
   ```
   Should match commit time for `ffe35ef`

### If Dark Tint Loads Correctly:
1. **Take screenshot** — Document working glass effect
2. **Test click/drag** — Verify interactions work
3. **Remove temporary code:**
   - Revert `resizable: true`
   - Remove DevTools auto-open
   - Remove auto-expand effect
4. **Add dedicated drag surface** — Full-window drag without blocking clicks

---

## 📝 Console Commands Reference

```javascript
// Quick diagnostic bundle
const mini = document.querySelector('.amx-mini');
console.group('Pill Diagnostics');
console.log('DOM:', mini?.className);
console.log('Logo:', document.querySelector('.amx-mini-logo') ? '✅' : '❌');
console.log('Background:', getComputedStyle(mini, '::before').background.slice(0, 100));
console.log('Backdrop filter:', getComputedStyle(mini, '::before').backdropFilter);
console.log('Element under cursor:', document.elementFromPoint(innerWidth/2, innerHeight/2)?.className);
console.log('Stylesheets:', [...document.styleSheets].map(s => s.href?.split('/').pop() || '(inline)'));
console.groupEnd();
```

---

**Last Updated:** Oct 17, 2025 9:24 AM  
**Commit:** `ffe35ef`  
**Branch:** `feature/glass-settings-appearance`
