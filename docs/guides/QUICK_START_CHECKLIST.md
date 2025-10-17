# Quick Start Implementation Checklist

**Goal:** Get started immediately with the UI rebrand.  
**Time:** Start seeing results in 30 minutes.

---

## Pre-Flight Check

Before starting, ensure:

- [ ] Application runs successfully (`npm run electron:dev`)
- [ ] You've read `UI_BRAND_GUIDE.md` (at least skimmed)
- [ ] You've read `UI_IMPLEMENTATION_ROADMAP.md` (overview)
- [ ] Git is clean (commit current work first)
- [ ] You have a second monitor or can quickly toggle between app and docs

---

## Step 1: Create Design Tokens (30 min)

### 1.1 Create Tokens File

- [ ] Create `/src/styles/tokens.css`
- [ ] Copy entire content from `PHASE_1_DESIGN_TOKENS.md`
- [ ] Save the file

### 1.2 Import Tokens

- [ ] Open `/src/styles/globals.css`
- [ ] Add at the very top (line 1):
  ```css
  @import './tokens.css';
  ```

### 1.3 Test Import

- [ ] Restart dev server (Ctrl+C, then `npm run electron:dev`)
- [ ] Check browser console - no errors should appear
- [ ] Open DevTools Console and run:
  ```js
  getComputedStyle(document.documentElement).getPropertyValue('--accent')
  ```
- [ ] Should return: `"#0FB5AE"` or `" #0FB5AE"` (with or without space)

✅ **Checkpoint:** Tokens are loaded

---

## Step 2: Update Tailwind Config (15 min)

### 2.1 Open Tailwind Config

- [ ] Open `/tailwind.config.js`

### 2.2 Replace Theme

- [ ] Replace the entire `theme.extend` object with the one from `PHASE_1_DESIGN_TOKENS.md`
- [ ] Save the file

### 2.3 Restart Dev Server

- [ ] Stop server (Ctrl+C)
- [ ] Start server (`npm run electron:dev`)
- [ ] Wait for Tailwind to rebuild

✅ **Checkpoint:** Tailwind classes updated

---

## Step 3: First Visual Change - Mini Pill (15 min)

### 3.1 Update Mini Pill Styles

- [ ] Open `/src/styles/globals.css`
- [ ] Find `.amx-mini` class (around line 225)
- [ ] Replace background:
  ```css
  /* OLD */
  background: hsla(220, 0%, 0%, 0.85);
  
  /* NEW */
  background: hsla(0, 0%, 100%, 0.92);
  ```
- [ ] Replace border:
  ```css
  /* OLD */
  border: 1px solid hsl(0, 0%, 0%);
  
  /* NEW */
  border: 1px solid rgba(0, 0, 0, 0.06);
  ```
- [ ] Replace box-shadow:
  ```css
  /* OLD */
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.3);
  
  /* NEW */
  box-shadow: 0 8px 24px rgba(11, 18, 32, 0.16);
  ```

### 3.2 Save and View

- [ ] Save the file
- [ ] Look at the app - mini pill should now be WHITE/LIGHT instead of black
- [ ] Logo should still be visible

✅ **Checkpoint:** You should see a light-colored mini pill!

---

## Step 4: Update Bar Mode (15 min)

### 4.1 Update Bar Background

- [ ] In `globals.css`, find `.amx-bar` class (around line 391)
- [ ] Replace background and border:
  ```css
  /* OLD */
  background: hsla(220, 0%, 0%, 0.85) !important;
  border: 1px solid hsla(0, 0%, 100%, 0.08) !important;
  
  /* NEW */
  background: hsla(0, 0%, 100%, 0.92);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  ```

### 4.2 Update Input Text Color

- [ ] Find `.amx-bar-input` class
- [ ] Replace color:
  ```css
  /* OLD */
  color: hsla(0, 0%, 100%, 0.85);
  
  /* NEW */
  color: var(--text);
  ```

### 4.3 Update Placeholder

- [ ] Find `.amx-bar-input::placeholder`
- [ ] Replace color:
  ```css
  /* OLD */
  color: hsla(0, 0%, 100%, 0.5);
  
  /* NEW */
  color: var(--muted);
  opacity: 0.6;
  ```

### 4.4 Test

- [ ] Click the mini pill to open bar mode
- [ ] Bar should be light/white
- [ ] Input text should be dark
- [ ] Placeholder should be readable gray

✅ **Checkpoint:** Bar mode is now light themed

---

## Step 5: Update Card/Chat Mode (20 min)

### 5.1 Update Card Background

- [ ] Find `.amx-card` class (around line 476)
- [ ] Update background:
  ```css
  /* The --panel variable is dark, we'll update it in globals */
  /* First, update the :root variables in globals.css */
  ```

### 5.2 Update Root Variables

- [ ] In `globals.css`, find the `:root` block (around line 19)
- [ ] **COMMENT OUT** or **DELETE** these old variables:
  ```css
  /* REMOVE OR COMMENT THESE */
  /* --bg: #0f1115; */
  /* --panel: hsla(220, 14%, 18%, 0.50); */
  /* --bubble: hsla(220, 14%, 18%, 0.82); */
  /* --stroke: hsla(0, 0%, 100%, 0.06); */
  /* --text: hsla(0, 0%, 100%, 0.94); */
  /* --text-muted: hsla(0, 0%, 100%, 0.64); */
  /* --accent: hsl(0, 0%, 0%); */
  ```

### 5.3 Add New Variables (if not using tokens.css)

- [ ] Or better yet, replace the entire `:root` block with just:
  ```css
  /* These variables are now in tokens.css */
  /* We'll map old names to new names for compatibility */
  --panel: var(--surface);
  --bubble: var(--surface);
  --stroke: var(--border);
  ```

### 5.4 Test Chat View

- [ ] Type a message in bar mode and press Enter
- [ ] Should expand to card view
- [ ] Background should be light
- [ ] Chat bubbles should be white with dark text

✅ **Checkpoint:** Card mode is light themed

---

## Step 6: Update Text Colors Throughout (10 min)

### 6.1 Global Text Color

- [ ] Find `@layer base` in `globals.css` (around line 93)
- [ ] Update body styles:
  ```css
  html, body {
    background: transparent;  /* Keep transparent for Electron */
    color: var(--text);  /* Dark text */
    /* ... rest stays the same */
  }
  ```

### 6.2 Panel Text

- [ ] Find `.amx-panel` class
- [ ] Update color:
  ```css
  .amx-panel {
    /* ... existing styles ... */
    color: var(--text);  /* was: #eaeaf0 light gray */
  }
  ```

✅ **Checkpoint:** All text should be dark and readable

---

## Step 7: Quick Visual Check (5 min)

### 7.1 Test All Three Modes

- [ ] **Mini pill**: Light background, visible logo, shadow
- [ ] **Bar mode**: Light background, dark input text, muted placeholder
- [ ] **Card mode**: Light background, dark text, white bubbles

### 7.2 Check Readability

- [ ] All text should be easily readable
- [ ] No white text on white background
- [ ] No low-contrast issues

### 7.3 Screenshot & Compare

- [ ] Take a screenshot of each mode
- [ ] Compare to brand guide examples
- [ ] Note any remaining differences

✅ **Checkpoint:** Basic light theme is working!

---

## Step 8: Fix Common Issues (As needed)

### Issue: Logo not visible on light background

**Solution:** 
- [ ] Check if logo is white/light colored
- [ ] May need to swap logo file or add dark variant
- [ ] Update in `FloatBar.jsx` line ~863

### Issue: Text hard to read

**Solution:**
- [ ] Verify `--text` variable is `#0B1220` (dark)
- [ ] Check that backgrounds use `--surface` (#FFFFFF)
- [ ] Run contrast checker

### Issue: Shadows not visible

**Solution:**
- [ ] Light theme shadows are subtle
- [ ] Verify shadow values use `rgba(11, 18, 32, 0.16)` not black
- [ ] Increase opacity if needed (0.16 → 0.20)

### Issue: App looks broken/weird

**Solution:**
- [ ] Check browser console for CSS errors
- [ ] Verify tokens.css is imported FIRST
- [ ] Restart dev server
- [ ] Clear browser cache (Cmd+Shift+R)

---

## Next Steps After Quick Start

Once the basics are working:

1. **Continue with Phase 2** - Typography refinements
2. **Update accent color** - Replace blue with teal throughout
3. **Fix spacing** - Use 8pt grid variables
4. **Component migration** - Follow `COMPONENT_MIGRATION_GUIDE.md`
5. **Testing** - WCAG contrast checks, keyboard nav, etc.

---

## Success Criteria

You've completed the quick start if:

- ✅ Mini pill is light/white
- ✅ Bar mode is light/white
- ✅ Card mode is light/white
- ✅ Text is dark and readable
- ✅ No console errors
- ✅ App is still functional (can send messages)

**Time check:** If you've been going for more than 2 hours, take a break! The rest can wait.

---

## Rollback (If needed)

If something breaks:

```bash
# Revert all changes
git checkout -- src/styles/

# Or revert specific file
git checkout -- src/styles/globals.css
```

---

## Help & Debugging

### Check CSS Variables

```js
// In browser console
const root = document.documentElement;
const style = getComputedStyle(root);

// Check specific variable
style.getPropertyValue('--accent')  // Should be "#0FB5AE"
style.getPropertyValue('--text')    // Should be "#0B1220"
style.getPropertyValue('--surface') // Should be "#FFFFFF"
```

### Find Hardcoded Colors

```bash
# In terminal
grep -n "hsla.*0.*0.*0" src/styles/globals.css
```

### Common Mistakes

1. **Forgot to import tokens.css** - Import must be FIRST line
2. **Forgot to restart dev server** - Required after Tailwind changes
3. **Typo in variable name** - `--accent` not `--accent-color`
4. **Missing `var()`** - Must use `var(--accent)` not just `--accent`

---

## Time Breakdown

- Setup & tokens: **30 min**
- Tailwind config: **15 min**
- Mini pill: **15 min**
- Bar mode: **15 min**
- Card mode: **20 min**
- Text colors: **10 min**
- Testing: **5 min**

**Total: ~2 hours** for basic transformation

---

*Start here, then move to full phase implementation*
