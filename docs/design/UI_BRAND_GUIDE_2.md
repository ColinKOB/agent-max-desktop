# Agent Max — Comprehensive Brand & UI Guide (part 2)

> Purpose: define visuals, behavior, and assets so the Electron app looks clean, reads clearly, and feels native.

---

## 0) TL;DR for builders

* **System fonts**, no webfont jank. **8-pt spacing grid**. **AA contrast**. **Reduced motion** respected. **Light theme first** with tasteful translucency (macOS). ([MDN Web Docs][1])
* **Chat is the star**. Settings are boring (predictable). The **mini pill** is draggable, always-on-top, and expands into a quick **chat bar**. Use Electron’s **drag regions**, **vibrancy**, and **graceful show**. ([electronjs.org][2])

---

## 1) Brand Identity

### 1.1 Logo usage

* **Safe zone:** ≥ one “X-height” clear space on all sides.
* **Minimum sizes:**

  * App icon: provide 16, 32, 48, 128, 256, 512 px.
  * In-app logo: never render below 24 px height.
* **Variants:** full lockup (wordmark + mark), mark-only (for the 68×68 pill), monochrome, reversed.
* **Don’ts:** no stretching, recolors off palette, drop-shadows behind logo, or overlay on low-contrast backgrounds.

### 1.2 Color palette (light theme)

* **Background:** `#F7F9FB`
* **Surface:** `#FFFFFF` / **Subsurface:** `#F1F4F8` / **Border:** `#E5EAF0`
* **Text:** `#0B1220` / **Muted:** `#49566A`
* **Accent (teal):** `#0FB5AE` (hover: `#0AA099`)
* **Status:** Success `#1D966A`, Warning `#B86E00`, Danger `#D13B3B`
* **Contrast:** verify AA (4.5:1 normal text). ([W3C][3])

### 1.3 Voice & tone

* **Personality:** calm, precise, capable.
* **Principles:** prefer verbs over adjectives, short sentences, never condescend.
* **Microcopy:** “Copied.” “Saved.” “Retry with Model X.”

---

## 2) Foundations

### 2.1 Typography

* **Font stack:**
  `system-ui, -apple-system, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif;`
  (Native feel, no FOUT.) ([MDN Web Docs][1])
* **Sizes (rem @16px root):**
  Display 28/1.2; Title 22/1.3; Body 16/1.5; Caption 13/1.4; Mono 13/1.6.
* **Rules:** Headings slightly tighter tracking; body 1.5–1.6 line height.

### 2.2 Spacing & layout

* **Grid:** 8-pt spacing with optional 4-pt trims for tight controls. ([Material Design][4])
* **Breakpoints (desktop-first):** Compact ≤1024, Standard 1025–1440, Spacious ≥1441.
* **Gutters:** 24 / 32 / 40 px (compact/standard/spacious).

### 2.3 Color system & system integration

* **Color-scheme:** advertise support to let native UI chrome match theme.
  `:root { color-scheme: light dark; }` ([MDN Web Docs][5])
* **Translucency (macOS only):** limited vibrancy for nav/overlays; always test readability. ([Apple Developer][6])

### 2.4 Motion

* **Durations:** 150–220 ms micro; 240–320 ms large transitions; easing `cubic-bezier(.2,.8,.2,1)`.
* **Accessibility:** honor `prefers-reduced-motion: reduce`. ([MDN Web Docs][7])

---

## 3) App Structure

### 3.1 Chat Panel (primary)

* **Header (48 px):** model/status • session title (editable) • actions (Pin, History, Export).
* **Transcript:** virtualized list; message width max 760 px; gap 12–16 px.

  * **User bubble:** filled surface.
  * **Agent bubble:** plain surface + 2 px accent left rule.
  * **Code blocks:** full-width in bubble; Mono 13 px; one-tap copy.
* **Composer (64–88 px):** grows to 4 lines; attachments left; primary action right; Enter send, Shift+Enter newline.

### 3.2 Settings Panel (secondary)

* **Nav (left 240 px):** General, Models, Shortcuts, Privacy, Updates.
* **Content:** cards 16/24 px padding; toggles/segments; inline validation; instant apply + undo toast.

### 3.3 Persistent Mini Pill → Chat Bar

* **Mini pill:** 68×68, circular, slight elevation; hover ↑opacity; press scale 0.98.
* **Behavior:** frameless, transparent, draggable, always-on-top overlay; click expands to **chat bar** (e.g., 68×420) near its position; Esc collapses.
* **Electron specifics:**

  * Drag regions: `-webkit-app-region: drag` for chrome; `no-drag` on interactive children. Draggable regions **swallow pointer events**, so mark buttons/inputs appropriately. ([electronjs.org][2])
  * Always on top: `setAlwaysOnTop(true, level)`; validate z-order with fullscreen apps. ([electronjs.org][8])
  * Graceful show to avoid white-flash when loading. ([electronjs.org][8])
  * macOS vibrancy via `vibrancy`/`visualEffectState` (use sparingly). ([electronjs.org][8])

---

## 4) Components & Patterns

### 4.1 Primitives

* **Button (28 / 36 / 44 h):**
  Primary = accent fill; Secondary = subtle border `#E5EAF0`; Focus ring 2 px accent with 2 px offset.
* **Input/Textarea:** radius 12; 1 px border `#E5EAF0`; focus = accent border + ring.
* **Card:** radius 12; border 1 px; hover elevation only where it aids scanning (align with elevation guidance). ([Material Design][9])

### 4.2 Chat elements

* Bubbles (12–16 px padding).
* Inline tool results as “result cards” with status dot.
* Streaming indicator = 3-dot pulse; fall back to static label under reduced motion. ([MDN Web Docs][7])

### 4.3 Patterns

* **Dialogs/Sheets:** block background with low-alpha scrim; maintain focus trap; Esc closes.
* **Empty states:** 1–2 clickable examples; no marketing paragraphs.
* **Errors:** plain language + one actionable next step.

---

## 5) Accessibility (beyond basics)

* **Contrast:** text AA (4.5:1), large text ≥3:1; verify icons/borders too. ([W3C][3])
* **Keyboard:** complete tab order; Enter/Shift+Enter; Esc to close/ collapse; visible focus rings everywhere.
* **ARIA:** roles on dialogs, menus, lists; label controls with accessible names.
* **Scaling:** layouts survive 125–200% text zoom.
* **Motion:** `prefers-reduced-motion` disables parallax/scale; use opacity or instant state. ([MDN Web Docs][10])

---

## 6) Cross-Platform Notes

* **macOS:** use vibrancy only for sidebars/overlays where it improves hierarchy; ensure text contrast against varied wallpapers. ([Apple Developer][6])
* **Windows/Linux:** no vibrancy; use flat surfaces with subtle elevation.
* **System chrome matching:** set `color-scheme` so native scrollbars/controls adapt. ([MDN Web Docs][5])

---

## 7) Motion Specs

* **State changes:** 150–180 ms; **size/position**: 200–240 ms; **enter/exit**: 220–320 ms.
* **Easing:** standard transitions `cubic-bezier(.2,.8,.2,1)`; decelerate for entrances, accelerate for exits.
* **Do not animate:** color-only changes, long lists, focus rings (use instant).

---

## 8) Asset Repo & Delivery

* **Files:** `/brand/logo/{svg,png}/…`, `/icons/…`, `/illustrations/…`, `/tokens/{json,css}`
* **Naming:** `agentmax-logo-[light|dark|mono]-[size].svg`
* **Versioning:** Semantic: `brand v1.0`, `tokens v1.0.0`.
* **Hand-off:** include README with usage, sizes, and don’ts.

---

## 9) Governance

* **Owners:** Design lead + Eng lead.
* **Change process:** PR to `/brand` with before/after screenshots and rationale; version bump + changelog.
* **Deprecation:** mark components as Deprecated in the UI kit with removal date.

---

## 10) Do / Don’t (visual examples)

* **Do:** limit accent to actions and focus states; keep surfaces clean; short labels.
* **Don’t:** gradient floods, drop-shadows under logos, low-contrast overlays, chat bubbles wider than 760 px.

---

## 11) Design Tokens (JSON)

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

## 12) Base CSS (import once)

```css
:root {
  color-scheme: light dark; /* align UI chrome with theme */ /* see MDN */ 
  --bg:#F7F9FB; --surface:#FFF; --subsurface:#F1F4F8; --border:#E5EAF0;
  --text:#0B1220; --muted:#49566A; --accent:#0FB5AE; --accent-press:#0AA099;
  --success:#1D966A; --warn:#B86E00; --danger:#D13B3B;
  --r-sm:8px; --r-md:12px; --r-lg:16px; --r-pill:999px;
  --s-0:0; --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --s-7:40px;
}

html { font: 400 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif; }
body { margin:0; background:var(--bg); color:var(--text); }

button.primary {
  height:36px; padding:0 var(--s-4); border-radius:var(--r-md);
  background:var(--accent); color:#fff; border:0;
}
button.primary:focus-visible {
  outline:2px solid var(--accent); outline-offset:2px;
}

@media (prefers-reduced-motion: reduce) {
  * { transition:none !important; animation:none !important; } /* honor accessibility */
}
```

*References: system font + color-scheme + reduced-motion.* ([MDN Web Docs][1])

---

## 13) Electron Snippets (pill + chat bar)

**Draggable pill (HTML/CSS):**

```html
<div class="pill" role="button" aria-label="Open Agent Max">
  <img class="no-drag" src="logo.svg" alt="">
</div>
```

```css
.pill {
  width:68px; height:68px; border-radius:999px;
  backdrop-filter: blur(12px);
  -webkit-app-region: drag; /* make the shell draggable */
  box-shadow: 0 8px 24px rgba(2,6,23,.16);
}
.no-drag { -webkit-app-region: no-drag; } /* let logo click events pass through */
```

*Draggable regions ignore pointer events; mark interactive children `no-drag`.* ([electronjs.org][2])

**Window creation (main process):**

```js
const {BrowserWindow} = require('electron');

function createPill() {
  const win = new BrowserWindow({
    width: 68, height: 68,
    frame: false, transparent: true, resizable: false, hasShadow: true,
    alwaysOnTop: true, // keep above normal windows
    vibrancy: 'popover', // macOS-only: subtle translucency
    visualEffectState: 'active' // keep material “on”
  });

  // Avoid white-flash; show after ready
  win.once('ready-to-show', () => win.show()); // graceful show
  return win;
}
```

*Use `ready-to-show` to avoid visual flash; use macOS vibrancy judiciously.* ([electronjs.org][8])

**Keep on top (z-level considerations):**

```js
// test levels if needed: 'floating', 'screen-saver', etc.
win.setAlwaysOnTop(true, 'floating');
```

*Validate against OS fullscreen behaviors.* ([electronjs.org][8])

---

## 14) Usage Scenarios (wireframe mockups)

**A) Chat (standard width)**

* Header 48 px → Session title, Status dot, Actions
* Transcript (max 760 px) → alternating bubbles
* Composer (sticky) with attachments + primary CTA

```
┌──────────────────────────────────────────────────────────────┐
│ ● Model • Session Title                     [Pin] [Export]   │
├──────────────────────────────────────────────────────────────┤
│   You: message…                                              │
│   Max: response…                                             │
│   …                                                          │
├──────────────────────────────────────────────────────────────┤
│ [＋]  Type your message…                                 [↩︎] │
└──────────────────────────────────────────────────────────────┘
```

**B) Settings (split view)**

```
┌───────────────┬──────────────────────────────────────────────┐
│ General       │  [Card] Theme: Light ⦿  Dark ○  System ○     │
│ Models        │  [Card] Default Model: vX.Y (speed/cost)      │
│ Shortcuts     │  [Card] Keybindings: [Edit]                   │
│ Privacy       │  [Card] Telemetry:  Off ⦿  On ○               │
│ Updates       │  [Card] Auto-update: On ⦿   [Check updates]   │
└───────────────┴──────────────────────────────────────────────┘
```

**C) Mini pill → Chat bar (expanded)**

```
(68px circle)  →  ┌───────────────────────────────┐
                  │  Ask Agent Max…        [↩︎]   │
                  └───────────────────────────────┘
```

---

## 15) Optional: Trend alignment (context)

Apple continues to lean into **translucent “glass” materials** on macOS; when using vibrancy, ensure text and controls meet contrast and legibility in varied wallpapers. This guide’s translucency usage follows Apple’s HIG stance: use vibrancy when it **improves** comprehension, not as decoration. ([Apple Developer][6])

---

### Quick references (primary sources)

* **Apple HIG: Materials & Color.** Vibrancy improves communication when tested across contexts. ([Apple Developer][6])
* **Electron docs:** drag regions, BrowserWindow options, graceful show, always-on-top. ([electronjs.org][2])
* **WCAG 2.2:** contrast AA ≥4.5:1; large text allowances. ([W3C][11])
* **MDN:** `prefers-reduced-motion`, `color-scheme`, `font-family` (system-ui). ([MDN Web Docs][7])
* **Material/8-pt spacing:** use 8dp/8px increments for rhythm. ([Material Design][4])

---

## 16) Deliverables checklist (for your repo)

* `[ ]` `/brand/` (logos, wordmarks, icons, README)
* `[ ]` `/tokens/tokens.json` (as above)
* `[ ]` `/tokens/base.css` (as above)
* `[ ]` `/ui/` component specs (buttons, inputs, cards, dialogs, toasts)
* `[ ]` `/examples/` (chat, settings, pill → chat bar)
* `[ ]` `/docs/CHANGELOG.md` & governance notes

---

If you want this split into **three files** (`BRAND.md`, `TOKENS.json`, `BASE.css`) or turned into a **Figma tokens export**, I can output those directly next.

[1]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-family?utm_source=chatgpt.com "font-family - CSS | MDN - Mozilla"
[2]: https://electronjs.org/es/docs/latest/tutorial/custom-window-interactions?utm_source=chatgpt.com "Custom Window Interactions"
[3]: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html?utm_source=chatgpt.com "Understanding Success Criterion 1.4.3: Contrast (Minimum)"
[4]: https://m2.material.io/design/layout/understanding-layout.html?utm_source=chatgpt.com "Understanding layout"
[5]: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme?utm_source=chatgpt.com "color-scheme - CSS | MDN - Mozilla"
[6]: https://developer.apple.com/design/human-interface-guidelines/materials?utm_source=chatgpt.com "Materials | Apple Developer Documentation"
[7]: https://developer.mozilla.org/en-US/docs/Web/CSS/%40media/prefers-reduced-motion?utm_source=chatgpt.com "prefers-reduced-motion - CSS | MDN - Mozilla"
[8]: https://electronjs.org/docs/latest/api/browser-window?utm_source=chatgpt.com "BrowserWindow"
[9]: https://m3.material.io/styles/elevation/applying-elevation?utm_source=chatgpt.com "Elevation – Material Design 3"
[10]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries_for_accessibility?utm_source=chatgpt.com "Using media queries for accessibility - CSS - MDN"
[11]: https://www.w3.org/TR/WCAG22/?utm_source=chatgpt.com "Web Content Accessibility Guidelines (WCAG) 2.2"
