# 🎨 CSS Customization Guide for Beginners

**File:** `src/styles/globals.css`  
**Last Updated:** October 11, 2025, 4:53 PM

This guide explains how to customize the Agent Max desktop app's appearance. All visual styling is in the `globals.css` file with detailed comments.

---

## 📚 Table of Contents

1. [Understanding CSS Variables](#css-variables)
2. [Color System](#color-system)
3. [Mini Pill Customization](#mini-pill)
4. [Bar Mode Customization](#bar-mode)
5. [Chat Bubbles](#chat-bubbles)
6. [Buttons & Icons](#buttons-icons)
7. [Common Customizations](#common-customizations)
8. [Quick Reference](#quick-reference)

---

## 🎨 CSS Variables

**Location:** Lines 19-91 in `globals.css`

CSS variables (also called custom properties) are reusable values that you can change once and they update everywhere.

### Format:
```css
--variable-name: value;
```

### Usage:
```css
color: var(--variable-name);
```

---

## 🌈 Color System

### Understanding HSLA Colors

**Format:** `hsla(hue, saturation, lightness, alpha)`

- **Hue (0-360):** The color itself
  - 0 = Red
  - 30 = Orange
  - 60 = Yellow
  - 120 = Green
  - 180 = Cyan
  - 240 = Blue
  - 280 = Purple
  - 360 = Red (full circle)

- **Saturation (0-100%):** Color intensity
  - 0% = Gray (no color)
  - 50% = Moderate
  - 100% = Vibrant

- **Lightness (0-100%):** Brightness
  - 0% = Black
  - 50% = Pure color
  - 100% = White

- **Alpha (0-1):** Transparency
  - 0 = Fully transparent
  - 0.5 = Half transparent
  - 1 = Fully opaque

### Main Color Variables:

```css
/* Panel background - Light glass */
--panel: hsla(220, 14%, 18%, 0.50);
/* 220 = blue, 14% = grayish, 18% = dark, 50% = half transparent */

/* Bubble background - Thicker glass */
--bubble: hsla(220, 14%, 18%, 0.82);
/* Same color but 82% opaque for readable text */

/* Border color - Hairline */
--stroke: hsla(0, 0%, 100%, 0.06);
/* Pure white at 6% opacity = barely visible */

/* Text colors */
--text: hsla(0, 0%, 100%, 0.94);  /* Primary - 94% white */
--text-muted: hsla(0, 0%, 100%, 0.64);  /* Secondary - 64% white */

/* Accent color - Highlights */
--accent: hsl(228, 100%, 74%);  /* Soft blue */
```

---

## 💊 Mini Pill Customization

**Location:** Lines 214-277 in `globals.css`

The mini pill is the small 68×68px square that appears when collapsed.

### Change Pill Color:

**Current (black):**
```css
background: hsla(220, 0%, 0%, 0.85);
```

**Options:**

**Dark gray:**
```css
background: hsla(220, 10%, 15%, 0.85);
```

**Dark blue:**
```css
background: hsla(220, 30%, 10%, 0.85);
```

**Lighter (more transparent):**
```css
background: hsla(220, 0%, 0%, 0.60);
```

### Change Roundness:

**Current:**
```css
border-radius: 18px;  /* Soft pill shape */
```

**Options:**
- `12px` = Slightly rounded
- `24px` = Very rounded
- `32px` = Almost circular
- `0px` = Sharp square

### Change Size:

Size is controlled in `electron/main.cjs` (lines 16-17):
```javascript
const windowWidth = 68;
const windowHeight = 68;
```

Change both to same value (e.g., `80` for larger pill).

### Change Shadow:

**Current:**
```css
box-shadow: 
  0 8px 24px rgba(0, 0, 0, 0.4),
  0 2px 8px rgba(0, 0, 0, 0.3);
```

**Softer shadow:**
```css
box-shadow: 
  0 12px 40px rgba(0, 0, 0, 0.3),
  0 4px 12px rgba(0, 0, 0, 0.2);
```

**No shadow:**
```css
box-shadow: none;
```

---

## 🔤 Bar Mode Customization

**Location:** Lines 381-449 in `globals.css`

The bar is the expanded input field (240×68px).

### Change Bar Width:

In `electron/main.cjs` (line 144):
```javascript
const windowWidth = 240;  // Change this number
```

Try: `300`, `360`, `400`

### Change Text Size:

```css
.amx-bar-input {
  font-size: 14px;  /* Change to 16px or 18px */
}
```

### Change Placeholder Text Color:

```css
.amx-bar-input::placeholder {
  color: var(--text-muted);  /* Change to var(--text) for brighter */
}
```

### Change Focus Ring Color:

```css
.amx-bar-input:focus {
  box-shadow: 0 0 0 2px var(--accent);
}
```

Replace `var(--accent)` with:
- `hsl(0, 100%, 70%)` = Red
- `hsl(30, 100%, 70%)` = Orange
- `hsl(120, 100%, 70%)` = Green

---

## 💬 Chat Bubbles

**Location:** Lines 647-700 in `globals.css`

### Change Bubble Background:

Modify the `--bubble` variable (line 40):
```css
--bubble: hsla(220, 14%, 18%, 0.82);
```

**More opaque (solid):**
```css
--bubble: hsla(220, 14%, 18%, 0.95);
```

**Lighter color:**
```css
--bubble: hsla(220, 14%, 25%, 0.82);
```

### Change Text Size:

```css
.amx-message-content {
  font-size: 13px;  /* Change to 14px or 15px */
}
```

### Change Bubble Roundness:

```css
.amx-message-content {
  border-radius: 10px;  /* Change to 12px or 16px */
}
```

### Make System Messages More Visible:

```css
.amx-message-thought .amx-message-content {
  opacity: 0.75;  /* Change to 0.9 or 1.0 */
}
```

---

## 🔘 Buttons & Icons

**Location:** Lines 546-591 in `globals.css`

### Change Button Size:

```css
.amx-icon-btn {
  width: 32px;   /* Change to 36px or 40px */
  height: 32px;  /* Keep same as width */
}
```

### Make Buttons Circular:

```css
.amx-icon-btn {
  border-radius: 50%;  /* Perfect circle */
}
```

### Change Icon Color:

```css
.amx-icon-btn {
  color: var(--text-muted);  /* Current: subtle */
}
```

**Options:**
- `var(--text)` = Bright white
- `var(--accent)` = Blue accent
- `hsl(30, 100%, 70%)` = Orange

### Add Button Background:

```css
.amx-icon-btn {
  background: hsla(220, 14%, 18%, 0.5);  /* Semi-transparent */
}
```

---

## 🎯 Common Customizations

### 1. Make Everything Darker

```css
/* In :root section */
--panel: hsla(220, 14%, 10%, 0.90);  /* Darker, more opaque */
--bubble: hsla(220, 14%, 12%, 0.95);
```

### 2. Make Everything Lighter

```css
--panel: hsla(220, 14%, 30%, 0.40);  /* Lighter, more transparent */
--bubble: hsla(220, 14%, 35%, 0.70);
```

### 3. Change Accent Color to Orange

```css
--accent: hsl(30, 100%, 65%);  /* Orange */
```

### 4. Change Accent Color to Purple

```css
--accent: hsl(280, 100%, 70%);  /* Purple */
```

### 5. Increase All Blur

```css
--blur: 30px;  /* Was: 20px */
```

### 6. Make All Corners Rounder

```css
--r-panel: 20px;   /* Was: 16px */
--r-el: 16px;      /* Was: 12px */
--r-pill: 14px;    /* Was: 10px */
```

### 7. Speed Up All Animations

```css
--transition: 100ms ease-out;  /* Was: 140ms */
```

### 8. Slow Down All Animations

```css
--transition: 250ms ease-out;  /* Was: 140ms */
```

---

## 📖 Quick Reference

### Most Common Changes:

| What to Change | Where | Line # |
|----------------|-------|--------|
| Pill color | `.amx-mini` background | 242 |
| Pill roundness | `.amx-mini` border-radius | 239 |
| Pill size | `electron/main.cjs` | 16-17 |
| Bar width | `electron/main.cjs` | 144 |
| Text size | `.amx-bar-input` font-size | 430 |
| Accent color | `--accent` | 55 |
| Blur amount | `--blur` | 65 |
| Animation speed | `--transition` | 88 |
| Bubble opacity | `--bubble` alpha | 40 |
| Border visibility | `--stroke` alpha | 45 |

### Color Presets:

**Dark Mode (current):**
```css
--panel: hsla(220, 14%, 18%, 0.50);
--bubble: hsla(220, 14%, 18%, 0.82);
```

**Light Mode:**
```css
--panel: hsla(220, 14%, 85%, 0.50);
--bubble: hsla(220, 14%, 90%, 0.82);
--text: hsla(0, 0%, 10%, 0.94);
--text-muted: hsla(0, 0%, 40%, 0.64);
```

**Blue Theme:**
```css
--panel: hsla(220, 40%, 15%, 0.50);
--bubble: hsla(220, 40%, 18%, 0.82);
--accent: hsl(220, 100%, 70%);
```

**Purple Theme:**
```css
--panel: hsla(280, 30%, 15%, 0.50);
--bubble: hsla(280, 30%, 18%, 0.82);
--accent: hsl(280, 100%, 70%);
```

---

## 💡 Tips for Beginners

### 1. **Make Small Changes**
Change one value at a time and save to see the effect.

### 2. **Use Browser DevTools**
Right-click → Inspect to test changes live before editing the file.

### 3. **Keep Backups**
Copy the original values in a comment before changing:
```css
/* Original: hsla(220, 14%, 18%, 0.50) */
--panel: hsla(220, 14%, 25%, 0.50);
```

### 4. **Test Readability**
After color changes, make sure text is still readable.

### 5. **Restart the App**
After saving changes, restart the app to see updates:
```bash
npm run electron:dev
```

### 6. **Use the Comments**
Every section in `globals.css` has detailed comments explaining what each property does.

---

## 🔍 Finding Things in the File

### Search Keywords:

- **Mini pill:** Search for "MINI PILL MODE"
- **Bar mode:** Search for "HORIZONTAL BAR MODE"
- **Chat bubbles:** Search for "CHAT BUBBLES"
- **Buttons:** Search for "ICON BUTTONS"
- **Colors:** Search for ":root" or "COLOR PALETTE"
- **Drag dots:** Search for "DRAG HANDLE"

---

## 🆘 Troubleshooting

### Changes Not Showing?
1. Save the file (Cmd/Ctrl + S)
2. Restart the app
3. Clear browser cache if using dev mode

### Text Not Readable?
- Increase text opacity: `--text: hsla(0, 0%, 100%, 0.98)`
- Increase bubble opacity: `--bubble` alpha to 0.90+

### Borders Not Visible?
- Increase stroke opacity: `--stroke: hsla(0, 0%, 100%, 0.12)`

### Too Blurry?
- Decrease blur: `--blur: 15px` or `10px`

### Too Slow/Fast?
- Adjust transition: `--transition: 100ms` (fast) or `200ms` (slow)

---

**Happy customizing!** 🎨

Remember: The CSS file has detailed comments on every section. Look for the `/* ==== */` headers to find what you want to change.
