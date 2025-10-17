# 🎨 UI Customization Guide for Beginners

**Last Updated:** October 15, 2025  
**File to Edit:** `src/styles/globals.css`

This guide explains how to customize the Agent Max UI in simple terms, even if you're new to CSS.

---

## 📍 Quick Navigation

| What to Change | Line Number | Section |
|----------------|-------------|---------|
| Window transparency | 307, 450, 534 | Glassmorphism |
| Blur amount | 310, 453, 537 | Glassmorphism |
| Text colors | 679, 695, 806 | Headers & Labels |
| Button size | 743-744 | Icon Buttons |
| Button colors | 738, 752 | Icon Buttons |
| Chat bubble colors | 820-830 | Messages |

---

## 🪟 Glassmorphism (See-Through Window Effect)

### What is Glassmorphism?
It's the frosted glass effect that lets you see your desktop through the window.

### Where to Edit:
- **Mini Pill:** Line 307
- **Bar Mode:** Line 450
- **Card Mode:** Line 534

### 1. **Transparency** (How See-Through)

```css
background: rgba(255, 255, 255, 0.08);
                              ^^^^
                              This number controls transparency
```

**What the numbers mean:**
- `rgba(255, 255, 255, 0.05)` = **5% white** - VERY transparent (almost invisible)
- `rgba(255, 255, 255, 0.08)` = **8% white** - Very transparent ← **CURRENT**
- `rgba(255, 255, 255, 0.15)` = **15% white** - Balanced
- `rgba(255, 255, 255, 0.20)` = **20% white** - Less transparent
- `rgba(255, 255, 255, 0.30)` = **30% white** - Quite opaque

**💡 TIP:** Lower number = MORE see-through!

---

### 2. **Blur Amount** (Frosted Glass Effect)

```css
backdrop-filter: saturate(140%) blur(30px);
                                    ^^^^
                                    This number controls blur
```

**What the numbers mean:**
- `blur(20px)` = Light blur
- `blur(30px)` = Medium blur ← **CURRENT**
- `blur(40px)` = Heavy blur
- `blur(50px)` = Very heavy blur

**💡 TIP:** Higher number = MORE frosted glass effect!

---

### 3. **Color Saturation** (How Vibrant)

```css
backdrop-filter: saturate(140%) blur(30px);
                         ^^^^
                         This controls color vibrancy
```

**What the numbers mean:**
- `saturate(100%)` = Normal colors
- `saturate(140%)` = Vibrant colors ← **CURRENT**
- `saturate(180%)` = Very vibrant colors

**💡 TIP:** Higher number = MORE colorful!

---

### 4. **Border Brightness**

```css
border: 1px solid rgba(255, 255, 255, 0.6);
                                      ^^^
                                      This controls border visibility
```

**What the numbers mean:**
- `0.3` = Subtle border
- `0.6` = Visible border ← **CURRENT**
- `0.9` = Very bright border

---

## 🔤 Text Colors

### Header Text ("Hi, Colin")
**Line 695:**
```css
color: rgba(255, 255, 255, 0.95);
                          ^^^^
                          95% white = almost fully bright
```

**Change to:**
- `1.0` = 100% white (fully bright)
- `0.8` = 80% white (slightly dimmer)

---

### Label Text ("YOU", "AGENT MAX")
**Line 806:**
```css
color: rgba(255, 255, 255, 0.7);
                          ^^^
                          70% white = medium brightness
```

**Change to:**
- `0.9` = 90% white (brighter)
- `0.5` = 50% white (dimmer)

---

### "Thinking" Label
**Line 816:**
```css
color: var(--accent);  /* Teal color */
```

**Change to:**
- `rgba(138, 166, 255, 0.9)` = Blue
- `rgba(255, 100, 255, 0.9)` = Pink
- `rgba(100, 255, 100, 0.9)` = Green

---

## 🔘 Icon Buttons (Tools, Settings, Camera)

### Button Size
**Lines 743-744:**
```css
width: var(--button-lg);   /* 44px */
height: var(--button-lg);  /* 44px */
```

**Change to:**
- `48px` = Larger buttons
- `40px` = Smaller buttons
- `36px` = Much smaller buttons

---

### Button Background
**Line 738:**
```css
background: rgba(255, 255, 255, 0.1);
                              ^^^
                              10% white = subtle
```

**Change to:**
- `0.2` = 20% white (more visible)
- `0.3` = 30% white (quite visible)
- `0.05` = 5% white (very subtle)

---

### Icon Color
**Line 752:**
```css
color: rgba(255, 255, 255, 0.85);
                          ^^^^
                          85% white = light but not too bright
```

**Change to:**
- `1.0` = 100% white (fully bright)
- `0.7` = 70% white (dimmer)

---

### Button Shape
**Line 740:**
```css
border-radius: var(--radius-sm);  /* 8px = rounded square */
```

**Change to:**
- `50%` = Perfect circles
- `12px` = More rounded squares
- `4px` = Slightly rounded squares
- `0px` = Sharp corners (no rounding)

---

## 💬 Chat Messages

### User Message Bubbles ("YOU")
**Lines 820-830:**
```css
background: rgba(255, 255, 255, 0.95);  /* 95% white = almost solid */
```

**Change to:**
- `0.98` = 98% white (more solid, easier to read)
- `0.9` = 90% white (slightly more transparent)

---

### Agent Message Bubbles ("AGENT MAX")
**Lines 835-845:**
```css
background: rgba(255, 255, 255, 0.95);  /* 95% white */
border-left: 2px solid var(--accent);   /* Teal left border */
```

**Change border color:**
- `rgba(138, 166, 255, 0.8)` = Blue
- `rgba(255, 100, 255, 0.8)` = Pink
- `rgba(100, 255, 100, 0.8)` = Green

---

## 🎨 Understanding RGBA Colors

### What is `rgba(R, G, B, A)`?

- **R** = Red (0-255)
- **G** = Green (0-255)
- **B** = Blue (0-255)
- **A** = Alpha/Transparency (0.0-1.0)

### Examples:

```css
rgba(255, 255, 255, 1.0)   /* Pure white, fully opaque */
rgba(255, 255, 255, 0.5)   /* White, 50% transparent */
rgba(0, 0, 0, 1.0)         /* Pure black, fully opaque */
rgba(15, 181, 174, 1.0)    /* Teal (Agent Max accent color) */
rgba(138, 166, 255, 0.9)   /* Light blue, 90% opaque */
```

### Quick Color Picker:

| Color | RGBA Code |
|-------|-----------|
| White | `rgba(255, 255, 255, 1.0)` |
| Black | `rgba(0, 0, 0, 1.0)` |
| Teal (Agent Max) | `rgba(15, 181, 174, 1.0)` |
| Light Blue | `rgba(138, 166, 255, 1.0)` |
| Pink | `rgba(255, 100, 255, 1.0)` |
| Green | `rgba(100, 255, 100, 1.0)` |
| Red | `rgba(255, 100, 100, 1.0)` |
| Yellow | `rgba(255, 255, 100, 1.0)` |

---

## 📐 Understanding CSS Units

### Pixels (px)
- `10px` = 10 pixels
- Used for: sizes, spacing, borders
- **Example:** `width: 44px;` = 44 pixels wide

### Percentages (%)
- `50%` = Half
- `100%` = Full
- Used for: transparency, saturation, sizes
- **Example:** `saturate(140%)` = 140% color saturation

### Decimal (0.0 - 1.0)
- `0.0` = 0% (fully transparent)
- `0.5` = 50% (half transparent)
- `1.0` = 100% (fully opaque)
- Used for: transparency in rgba()
- **Example:** `rgba(255, 255, 255, 0.8)` = 80% opaque white

---

## 🛠️ How to Make Changes

### Step 1: Open the File
```
src/styles/globals.css
```

### Step 2: Find the Line
Use the line numbers in this guide (e.g., "Line 307")

### Step 3: Change the Value
```css
/* BEFORE */
background: rgba(255, 255, 255, 0.08);

/* AFTER (more transparent) */
background: rgba(255, 255, 255, 0.05);
```

### Step 4: Save the File
The app will automatically reload with your changes!

---

## 💡 Pro Tips

### 1. **Make Small Changes**
Change one value at a time so you can see what each does.

### 2. **Keep a Backup**
Before making big changes, copy the original line as a comment:
```css
/* Original: background: rgba(255, 255, 255, 0.08); */
background: rgba(255, 255, 255, 0.15);  /* My custom value */
```

### 3. **Test on Different Backgrounds**
Move the window over:
- Colorful wallpapers
- Photos
- Text/apps
- Dark and light areas

### 4. **Use the Browser DevTools**
Press `Cmd+Option+I` to open DevTools and inspect elements live!

---

## 🎯 Common Customizations

### Make Window MORE Transparent
```css
/* Line 307, 450, 534 */
background: rgba(255, 255, 255, 0.05);  /* Was 0.08 */
```

### Make Window LESS Transparent
```css
/* Line 307, 450, 534 */
background: rgba(255, 255, 255, 0.20);  /* Was 0.08 */
```

### Increase Blur (More Frosted)
```css
/* Line 310, 453, 537 */
backdrop-filter: saturate(140%) blur(40px);  /* Was 30px */
```

### Decrease Blur (Less Frosted)
```css
/* Line 310, 453, 537 */
backdrop-filter: saturate(140%) blur(20px);  /* Was 30px */
```

### Make All Text Brighter
```css
/* Line 695 (Header) */
color: rgba(255, 255, 255, 1.0);  /* Was 0.95 */

/* Line 806 (Labels) */
color: rgba(255, 255, 255, 0.9);  /* Was 0.7 */
```

### Make Buttons Larger
```css
/* Lines 743-744 */
width: 48px;   /* Was 44px */
height: 48px;  /* Was 44px */
```

### Make Buttons Circular
```css
/* Line 740 */
border-radius: 50%;  /* Was var(--radius-sm) */
```

---

## 🚨 Troubleshooting

### Changes Not Showing?
1. **Save the file** (Cmd+S)
2. **Hard refresh** the app (Cmd+Shift+R)
3. **Restart the app** completely

### Window Looks Solid White?
Check if macOS "Reduce transparency" is enabled:
1. Open **System Settings**
2. Go to **Accessibility** → **Display**
3. Turn OFF "Reduce transparency"

### Blur Not Working?
Make sure these are set in `electron/main.cjs`:
```javascript
transparent: true,
vibrancy: 'under-window',
visualEffectState: 'active',
```

---

## 📚 Learn More

### CSS Resources for Beginners:
- [MDN CSS Basics](https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/CSS_basics)
- [CSS Tricks](https://css-tricks.com/)
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator)

### Color Pickers:
- [Google Color Picker](https://g.co/kgs/colorpicker)
- [Coolors](https://coolors.co/)
- [Adobe Color](https://color.adobe.com/)

---

**Happy Customizing! 🎨✨**

*If you make something cool, share it!*
