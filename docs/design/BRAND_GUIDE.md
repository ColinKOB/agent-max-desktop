# Agent Max -- Brand & UI Guide (v1.0)

> Implementation-ready reference for building Agent Max's Electron UI.
> System fonts, 8-pt spacing grid, AA contrast, reduced-motion respected, light theme first with tasteful translucency (macOS). Chat is the star. Settings are boring (predictable). The mini pill is draggable, always-on-top, and expands into a quick chat bar.

---

## 1) Brand Identity

### 1.1 Voice & Tone

* **Personality:** calm, precise, capable. No ornament that doesn't serve legibility or speed.
* **Principles:** prefer verbs over adjectives, short sentences, never condescend.
* **Primary surface:** light by default; subtle translucency where it improves hierarchy.
* **Interaction style:** hint at depth with gentle elevation and motion; otherwise disappear.

### 1.2 Logo Usage

* **Safe zone:** one "X-height" clear space on all sides minimum.
* **Minimum sizes:**
  * App icon: provide 16, 32, 48, 128, 256, 512 px.
  * In-app logo: never render below 24 px height.
* **Variants:** full lockup (wordmark + mark), mark-only (for the 68x68 pill), monochrome, reversed.
* **Don'ts:** no stretching, recolors off palette, drop-shadows behind logo, or overlay on low-contrast backgrounds.

### 1.3 Content Rules

* **Microcopy:** short, literal, action-oriented -- "Retry with Model X", "Saved", "Copied".
* **Empty states:** 1--2 clickable examples the user can try; no marketing paragraphs.
* **Error states:** plain language, one-line cause + one actionable next step.

### 1.4 Do / Don't

* **Do:** limit accent to actions and focus states; keep surfaces clean; short labels.
* **Don't:** gradient floods, drop-shadows under logos, low-contrast overlays, chat bubbles wider than 760 px.

---

## 2) Foundations

### 2.1 Typography

* **Font stack (cross-platform, zero-jank):**

  ```
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
  font-feature-settings: "calt" 1, "kern" 1, "liga" 1;
  ```

  Uses the system UI font to match the OS and avoid webfont loading delay.

* **Scale (rem, based on 16 px root):**

  | Token   | Size | Line-height | Weight    |
  |---------|------|-------------|-----------|
  | Display | 28   | 1.2         | semi-bold |
  | Title   | 22   | 1.3         | semi-bold |
  | Body    | 16   | 1.5         | regular   |
  | Caption | 13   | 1.4         | regular   |
  | Mono    | 13   | 1.6         | regular   |

* **Rules:** tighten headings (-0.2 px tracking at 22 px+). Keep body at 1.5--1.6 line height for long chat messages.

### 2.2 Color Palette (Light Theme)

| Token      | Hex       | Usage                        |
|------------|-----------|------------------------------|
| Background | `#F7F9FB` | Page/app background          |
| Surface    | `#FFFFFF` | Cards, panels                |
| Subsurface | `#F1F4F8` | Inset/secondary areas        |
| Border     | `#E5EAF0` | Dividers, input borders      |
| Text       | `#0B1220` | Primary text                 |
| Muted      | `#49566A` | Secondary/helper text        |
| Accent     | `#0FB5AE` | Interactive elements (teal)  |
| Accent hover | `#0AA099` | Hover/press state          |
| Success    | `#1D966A` | Positive status              |
| Warning    | `#B86E00` | Caution status               |
| Danger     | `#D13B3B` | Destructive/error status     |

* **Contrast:** meet or exceed WCAG 2.2 AA (4.5:1 normal text, 3:1 large text/UI icons). Verify accent on light surfaces.
* **System integration:** advertise `color-scheme: light dark;` so native scrollbars/controls match OS theme.

### 2.3 Spacing & Layout

* **Grid:** 8-pt base (allow 4-pt for tight controls). Keeps rhythm predictable across panes and components.
* **Breakpoints (desktop-first):**

  | Name     | Range        |
  |----------|--------------|
  | Compact  | <=1024 px     |
  | Standard | 1025--1440 px |
  | Spacious | >=1441 px     |

* **Container gutters:** 24 / 32 / 40 px (compact / standard / spacious).

### 2.4 Motion

* **Durations:**
  * State changes: 150--180 ms
  * Size/position: 200--240 ms
  * Enter/exit: 220--320 ms
* **Easing:** `cubic-bezier(.2,.8,.2,1)` -- decelerate for entrances, accelerate for exits.
* **Do not animate:** color-only changes, long lists, focus rings (use instant).
* **Accessibility:** honor `prefers-reduced-motion: reduce` -- remove parallax/scale, switch to opacity or instant state changes.

---

## 3) Application Structure

### 3.1 Chat Panel (primary)

* **Header (48 px):** model/status dot, session title (editable), right-aligned actions (Pin, History, Export).
* **Transcript:** virtualized list; message width max 760 px; message gap 12--16 px.
  * **User bubble:** subtle filled surface.
  * **Agent bubble:** plain surface + 2 px accent left rule for scannability.
  * **Code blocks:** full-width within bubble, monospace 13 px, copy button top-right.
* **Composer (64--88 px):** single row by default; grows to max 4 lines; attachments at left; primary action at right. Shortcut hints on hover; Enter to send, Shift+Enter for newline.
* **Empty state:** short, practical tips -- not marketing.

### 3.2 Settings Panel (secondary)

* **Nav (left, 240 px):** General, Models, Shortcuts, Privacy, Updates.
* **Content (right):** cards with 16/24 px padding; toggles and segmented controls; inline validation.
* **Save model:** apply instantly with undo toast (5 s).
* **Segmented control** for model selection; explain cost/speed as secondary text.
* **Toggle** for telemetry; link to policy next to control (not hidden).
* **Keybinding editor** with inline capture and conflict detection.

### 3.3 Persistent Mini Pill / Chat Bar

* **Mini pill:** 68x68 px, circular logo, drop shadow at 8dp equivalent. Idle opacity 92%; hover 100%; press scale 0.98.
* **Behavior:** draggable, always-on-top overlay window. Click expands horizontally into a **chat bar** (e.g., 68x420 px) anchored near current position; Esc or click-away to collapse.
* **States:** idle -> hover -> pressed -> dragging -> expanded -> collapsed. Animate scale (1.00 -> 1.03) and subtle y-translate (-2 px) on hover; snap to pixel grid on release. Respect `prefers-reduced-motion`.

### 3.4 Wireframes

**A) Chat (standard width)**

```
+--------------------------------------------------------------+
| * Model . Session Title                     [Pin] [Export]   |
+--------------------------------------------------------------+
|   You: message...                                            |
|   Max: response...                                           |
|   ...                                                        |
+--------------------------------------------------------------+
| [+]  Type your message...                               [->] |
+--------------------------------------------------------------+
```

**B) Settings (split view)**

```
+---------------+----------------------------------------------+
| General       |  [Card] Theme: Light *  Dark o  System o     |
| Models        |  [Card] Default Model: vX.Y (speed/cost)    |
| Shortcuts     |  [Card] Keybindings: [Edit]                  |
| Privacy       |  [Card] Telemetry:  Off *  On o              |
| Updates       |  [Card] Auto-update: On *   [Check updates]  |
+---------------+----------------------------------------------+
```

**C) Mini pill -> Chat bar (expanded)**

```
(68 px circle)  ->  +-------------------------------+
                    |  Ask Agent Max...        [->] |
                    +-------------------------------+
```

---

## 4) Components

### 4.1 Primitives

* **Button**
  * Sizes: 28 / 36 / 44 px heights.
  * Primary: accent fill, white text; hover darken 6%, active 10%.
  * Secondary: subtle stroke `#E5EAF0`, text color `#0B1220`.
  * Focus ring: 2 px accent outline with 2 px gap (offset).

* **Input / Textarea**
  * 12 px radius; 1 px border `#E5EAF0`; focus border accent + ring.
  * Placeholder color = muted text at 60%.

* **Card**
  * 12 px radius; 1 px border; hover elevation only where it aids scanning.

### 4.2 Chat Elements

* **Message bubble:** 12--16 px padding. Reactions/quick actions appear on hover at top-right (copy, cite, run).
* **Inline tool output:** "result card" style with monospace summary, colored status dot.
* **Streaming indicator:** three-dot pulse; switch to static "Generating..." label under `prefers-reduced-motion: reduce`.
* **Attachments:** file chips with icon + name + size; progress bar 2 px along bottom while uploading.

### 4.3 Patterns

* **Dialogs/Sheets:** block background with low-alpha scrim; maintain focus trap; Esc closes.
* **Toasts:** undo actions, 5 s duration, dismissible.

---

## 5) Accessibility

* **Contrast:** text AA (4.5:1), large text >=3:1; verify icons/borders too.
* **Keyboard:** complete Tab order; Enter to send; Shift+Enter newline; Esc to close/collapse; visible focus rings at all actionable controls.
* **ARIA:** roles on dialogs, menus, lists; label controls with accessible names.
* **Scaling:** layouts must survive 125--200% text zoom.
* **Motion:** `prefers-reduced-motion: reduce` disables parallax/scale; use opacity or instant state.
* **Hit targets:** minimum 44x44 px.
* **System color integration:** opt into `color-scheme` so scrollbars/controls match OS theme.

---

## 6) Cross-Platform Notes

* **macOS:** use vibrancy only for sidebars/overlays where it improves hierarchy; ensure text contrast against varied wallpapers. Apply to the chat bar background and left settings nav only, with 12--16 px inner blur and high-contrast foreground.
* **Windows/Linux:** no vibrancy; use flat surfaces with subtle elevation.
* **System chrome:** set `color-scheme` so native scrollbars/controls adapt.

---

## 7) Electron Implementation

### 7.1 Frameless, Draggable UI

Apply `-webkit-app-region: drag` **only** to the non-interactive container; set `-webkit-app-region: no-drag` on buttons/inputs. Draggable regions swallow pointer events -- do not overlap controls.

### 7.2 Mini Pill Window Config

* `transparent: true`, `frame: false`, `resizable: false`, `hasShadow: true`
* `alwaysOnTop: true` with level (e.g., `'floating'`); validate z-order with fullscreen apps and Spaces.
* Defer show until `ready-to-show` to avoid white-flash.

### 7.3 macOS Vibrancy

`vibrancy: 'sidebar' | 'popover'` and `visualEffectState: 'active' | 'inactive' | 'followWindow'`. Keep contrast high; test against varied wallpapers.

### 7.4 Snippets

**Draggable pill (HTML/CSS):**

```html
<div class="pill" role="button" aria-label="Open Agent Max">
  <img class="no-drag" src="logo.svg" alt="">
</div>
```

```css
.pill {
  width: 68px; height: 68px; border-radius: 999px;
  backdrop-filter: blur(12px);
  -webkit-app-region: drag;
  box-shadow: 0 8px 24px rgba(2,6,23,.16);
}
.no-drag { -webkit-app-region: no-drag; }
```

**Window creation (main process):**

```js
const { BrowserWindow } = require('electron');

function createPill() {
  const win = new BrowserWindow({
    width: 68, height: 68,
    frame: false, transparent: true, resizable: false, hasShadow: true,
    alwaysOnTop: true,
    vibrancy: 'popover',          // macOS-only
    visualEffectState: 'active'
  });

  win.once('ready-to-show', () => win.show()); // avoid white-flash
  return win;
}
```

**Always-on-top (z-level tuning):**

```js
// Test levels: 'floating', 'screen-saver', etc.
win.setAlwaysOnTop(true, 'floating');
```

---

## 8) Design Tokens

### 8.1 CSS Tokens

```css
:root {
  color-scheme: light dark;

  /* colors */
  --bg: #F7F9FB;
  --surface: #FFFFFF;
  --subsurface: #F1F4F8;
  --border: #E5EAF0;
  --text: #0B1220;
  --muted: #49566A;
  --accent: #0FB5AE;
  --accent-press: #0AA099;
  --danger: #D13B3B;
  --warn: #B86E00;
  --success: #1D966A;

  /* spacing (8-pt grid) */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;

  /* radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  /* z-index */
  --z-overlay: 1000;
  --z-pill: 1100;
  --z-toasts: 1200;
}

html {
  font: 400 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Inter,
    "Helvetica Neue", Arial, sans-serif;
}
body { margin: 0; background: var(--bg); color: var(--text); }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

### 8.2 JSON Tokens

```json
{
  "version": "1.0.0",
  "color": {
    "bg": "#F7F9FB",
    "surface": "#FFFFFF",
    "subsurface": "#F1F4F8",
    "border": "#E5EAF0",
    "text": "#0B1220",
    "muted": "#49566A",
    "accent": "#0FB5AE",
    "accentHover": "#0AA099",
    "success": "#1D966A",
    "warning": "#B86E00",
    "danger": "#D13B3B"
  },
  "radius": { "sm": 8, "md": 12, "lg": 16, "pill": 999 },
  "space": { "0": 0, "1": 4, "2": 8, "3": 12, "4": 16, "5": 24, "6": 32, "7": 40 },
  "z": { "overlay": 1000, "pill": 1100, "toast": 1200 },
  "type": {
    "display": { "size": 28, "lh": 1.2, "weight": 600 },
    "title":   { "size": 22, "lh": 1.3, "weight": 600 },
    "body":    { "size": 16, "lh": 1.5, "weight": 400 },
    "caption": { "size": 13, "lh": 1.4, "weight": 400 },
    "mono":    { "size": 13, "lh": 1.6, "weight": 400 }
  }
}
```

---

## 9) QA Checklist (ship-blocking)

* [ ] Typography uses system font; no layout shift from font loads.
* [ ] All text/controls meet WCAG AA contrast.
* [ ] `prefers-reduced-motion` honored.
* [ ] Mini pill drag works without blocking any button/input events.
* [ ] Chat composer: Enter/Shift+Enter behaviors correct; focus ring visible.
* [ ] Settings changes are instant (with undo) and persist across restarts.
* [ ] No white-flash on window show; no tearing during expand/collapse.
* [ ] Layouts survive 125--200% text zoom.

---

## 10) Asset Repo & Delivery

* **Files:** `/brand/logo/{svg,png}/...`, `/icons/...`, `/illustrations/...`, `/tokens/{json,css}`
* **Naming:** `agentmax-logo-[light|dark|mono]-[size].svg`
* **Versioning:** semantic -- `brand v1.0`, `tokens v1.0.0`.

### Deliverables Checklist

* `[ ]` `/brand/` (logos, wordmarks, icons, README)
* `[ ]` `/tokens/tokens.json`
* `[ ]` `/tokens/base.css`
* `[ ]` `/ui/` component specs (buttons, inputs, cards, dialogs, toasts)
* `[ ]` `/examples/` (chat, settings, pill -> chat bar)
* `[ ]` `/docs/CHANGELOG.md` & governance notes

---

## 11) Governance

* **Owners:** Design lead + Eng lead.
* **Change process:** PR to `/brand` with before/after screenshots and rationale; version bump + changelog.
* **Deprecation:** mark components as Deprecated in the UI kit with removal date.

---

### References

* [MDN: font-family / system-ui](https://developer.mozilla.org/en-US/docs/Web/CSS/font-family)
* [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
* [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
* [W3C: WCAG 2.2 Contrast](https://www.w3.org/TR/WCAG22/)
* [Material Design: Spacing](https://m2.material.io/design/layout/understanding-layout.html)
* [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
* [Electron: Custom Window Interactions](https://electronjs.org/es/docs/latest/tutorial/custom-window-interactions)
* [Electron: BrowserWindow API](https://electronjs.org/docs/latest/api/browser-window)
