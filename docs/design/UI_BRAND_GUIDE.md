Here’s the no-nonsense version: Agent Max should feel fast, readable, and invisible until needed. Use a light, glass-influenced look, a strict 8-point spacing scale, system fonts, and ruthless focus on the chat flow. The mini pill is a true desktop citizen (draggable, always on top, zero jank), and the Settings panel is boring by design.

---

# Agent Max — UI Brand Guide (v0.9)

> A concise, implementation-ready reference for building Agent Max’s Electron UI.

## 1) Brand Tone

* **Personality:** calm, precise, capable. No ornament that doesn’t serve legibility or speed.
* **Primary surface:** light by default; subtle translucency where it improves hierarchy.
* **Interaction style:** hint at depth with gentle elevation and motion; otherwise disappear.

---

## 2) Foundations

### 2.1 Typography

* **Font stack (cross-platform, zero-jank):**

  ```
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
  font-feature-settings: "calt" 1, "kern" 1, "liga" 1;
  ```

  Use the system UI font to match the OS and avoid webfont loading delay. ([MDN Web Docs][1])
* **Scale (rem, based on 16px root):**

  * Display 28 / 1.2 / semi-bold
  * Title 22 / 1.3 / semi-bold
  * Body 16 / 1.5 / regular
  * Mono (code): 13 / 1.6 / regular
* **Rules:** Tighten headings (−0.2px tracking at ≥22px). Keep body at 1.5–1.6 line height for long chat messages.

### 2.2 Layout & Spacing

* **Grid:** 8-point base (allow 4-point for tight controls). Keeps rhythm predictable across panes and components. ([Material Design][2])
* **Breakpoints (desktop-first):**

  * Compact: ≤1024px
  * Standard: 1025–1440px
  * Spacious: ≥1441px
* **Container gutters:** 24 / 32 / 40px (compact/standard/spacious).

### 2.3 Color & Elevation

* **Light theme tokens (hex):**

  * Background: `#F7F9FB`
  * Surface: `#FFFFFF`
  * Subsurface: `#F1F4F8`
  * Border: `#E5EAF0`
  * Text: `#0B1220`
  * Muted text: `#49566A`
  * Accent (teal): `#0FB5AE`
  * Accent hover: `#0AA099`
  * Danger: `#D13B3B`
  * Warning: `#B86E00`
  * Success: `#1D966A`
* **Contrast:** Meet or exceed WCAG 2.2 AA (4.5:1 for normal text). Use a checker when pairing accent on light surfaces. ([W3C][3])
* **System color integration:** Advertise supported schemes with `color-scheme: light dark;` and `<meta name="color-scheme" content="light dark">` so native controls match. ([MDN Web Docs][4])

### 2.4 Motion

* **Defaults:** 150–220 ms transitions; 240–320 ms for large transforms. Easing: `cubic-bezier(.2,.8,.2,1)`
* **Respect user prefs:** disable non-essential motion for `prefers-reduced-motion: reduce`. ([MDN Web Docs][5])

---

## 3) Application Structure

### 3.1 Two Main Panels

**A) Chat Panel (primary)**
Purpose: everything centers here.

* **Header (48px):** model/status dot • session title (editable) • right-aligned actions (Pin, History, Export).
* **Transcript area:** virtualized list; message width max 760px; message gap 12–16px.

  * **User bubble:** subtle filled surface.
  * **Agent bubble:** plain surface + left rule `2px` in accent for scannability.
  * **Code blocks:** full-width within bubble, monospace 13px, copy button top-right.
* **Composer (64–88px):** single row by default; grows to max 4 lines; attachments at left; primary action at right.

  * Shortcut hints on hover; shift+enter for newline.
* **Empty state:** short, practical tips—not marketing.

**B) Settings Panel (secondary)**
Purpose: be predictable and fast.

* **Nav (left, 240px):** categories (General, Models, Shortcuts, Privacy, Updates).
* **Content (right):** cards with 16/24px padding, toggles and segmented controls; inline validation.
* **Save model:** apply instantly with undo toast (5s).

### 3.2 Persistent Mini Pill → Chat Bar

* **Mini pill:** 68×68px, circular logo, drop shadow at 8dp equivalent. Idle opacity 92%; hover 100%; press 98%.
* **Behavior:** draggable, always-on-top overlay window. When clicked, it expands horizontally into a **chat bar** (e.g., 68×420px) anchored near its current position; press Esc or click away to collapse.
* **Implementation notes (Electron):**

  * Use a frameless, transparent `BrowserWindow`. For drag, mark the container with `-webkit-app-region: drag`; all interactive children must be `-webkit-app-region: no-drag` or pointer events won’t fire. ([Electron][6])
  * Keep on top via `setAlwaysOnTop(true, level)`. Choose a level such as `"floating"` or `"screen-saver"` based on desired z-order; test across full-screen apps. ([Electron][7])
  * macOS translucency/vibrancy is supported via `vibrancy` + `visualEffectState` on the window; use sparingly to preserve contrast. ([Electron][8])
* **States:** idle → hover → pressed → dragging → expanded → collapsed. Animate scale (1.00→1.03) and subtle y-translate (−2px) on hover; snap to pixel grid when released. Respect `prefers-reduced-motion`.

---

## 4) Components

### 4.1 Core Primitives

* **Button**

  * Sizes: 28 / 36 / 44px heights
  * Primary: accent fill, white text; hover darken 6%, active 10%
  * Secondary: subtle stroke `#E5EAF0`, text color `#0B1220`
  * Focus ring: 2px accent outline with 2px gap (offset)
* **Input / Textarea**

  * 12px radius; 1px border `#E5EAF0`; focus border accent + ring
  * Placeholder color = muted text at 60%
* **Card**

  * 12px radius; 1px border; elevation (shadow at 8dp) only on hover/focus

### 4.2 Chat Elements

* **Message bubble**

  * Padding: 12–16px
  * Reactions/quick actions appear on hover at top-right (copy, cite, run)
* **Inline tool output**

  * Use a “result card” style with monospace summary, colored status dot.
* **Streaming indicator**

  * Three-dot pulse; when `prefers-reduced-motion: reduce`, switch to static “Generating…” label. ([MDN Web Docs][5])
* **Attachments**

  * File chips with icon + name + size; progress bar 2px along bottom while uploading.

### 4.3 Settings Controls

* **Segmented control** for model selection; explain cost/speed as secondary text.
* **Toggle** for telemetry; link to policy next to control (not hidden).
* **Keybinding editor** with inline capture and conflict detection.

---

## 5) Glass & Translucency (macOS)

Use translucency to separate layers without heavy boxes. Apply to the **chat bar background** and **left settings nav** only, with a 12–16px inner blur and high-contrast foreground. Follow Apple’s “materials and vibrancy” guidance; avoid vibrancy when it harms legibility. ([Apple Developer][9])

**Electron specifics:** set window `vibrancy` and adjust `visualEffectState` (`'active'|'inactive'|'followWindow'`) to match focus. Test against varying wallpapers. ([Electron][8])

---

## 6) Accessibility & Input

* **Contrast:** AA minimums (4.5:1 text, 3:1 for UI icons); verify accent on light surfaces. ([W3C][3])
* **Keyboard:** Complete Tab order; **Enter** to send; **Shift+Enter** newline; **Esc** to collapse chat bar/pill; visible focus ring at all actionable controls.
* **Motion:** Support `prefers-reduced-motion: reduce` (remove parallax/scale, switch to opacity or instant state changes). ([MDN Web Docs][5])
* **System color integration:** opt into `color-scheme` so scrollbars/controls match OS theme. ([MDN Web Docs][4])
* **Hit targets:** min 44×44px.

---

## 7) Design Tokens (example)

```css
:root {
  /* spacing */
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
}
```

**OS integration:**

```css
:root { color-scheme: light dark; } /* native scrollbars/controls */ /* :contentReference[oaicite:14]{index=14} */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; } /* :contentReference[oaicite:15]{index=15} */
}
```

---

## 8) Electron Implementation Notes (critical)

* **Frameless, draggable UI:** apply `-webkit-app-region: drag` **only** to the non-interactive container; set `-webkit-app-region: no-drag` on buttons/inputs. Draggable regions swallow pointer events—don’t overlap controls. ([Electron][6])
* **Mini pill window:**

  * `transparent: true`, `frame: false`, `resizable: false`, `hasShadow: true`
  * `alwaysOnTop: true` with an appropriate level (e.g., `'floating'`); confirm behavior with full-screen apps and Spaces. ([Electron][7])
* **Vibrancy:** `vibrancy: 'sidebar' | 'popover'` and `visualEffectState: 'active'|'inactive'|'followWindow'` for macOS. Keep contrast high. ([Electron][8])
* **Show window gracefully:** defer show until ready to avoid white-flash. ([Electron][7])

---

## 9) Content Rules

* **Microcopy:** short, literal, and action-oriented (“Retry with Model X”, “Saved”, “Copied”).
* **Empty states:** 1-2 crisp examples the user can click to try.
* **Error states:** plain language, one-line cause + one action.

---

## 10) QA Checklist (ship-blocking)

* Typography uses system font; no layout shift from font loads. ([MDN Web Docs][1])
* All text/controls meet WCAG AA contrast. ([W3C][3])
* `prefers-reduced-motion` honored. ([MDN Web Docs][5])
* Mini pill drag works without blocking any button/input events. ([Electron][6])
* Chat composer: Enter/Shift+Enter behaviors correct; focus ring visible.
* Settings changes are instant (with undo) and persist across restarts.
* No white-flash on window show; no tearing during expand/collapse. ([Electron][7])

---

## 11) Appendix — Snippets

**Draggable pill container (safe regions):**

```html
<div class="pill" role="button" aria-label="Open Agent Max">
  <img class="logo no-drag" src="logo.svg" alt="" />
</div>
```

```css
.pill { width: 68px; height: 68px; border-radius: 999px; box-shadow: 0 8px 24px rgba(2,6,23,.16);
        backdrop-filter: blur(12px); -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }
```

*Draggable areas consume pointer events; mark interactive children as `no-drag`.* ([Electron][6])

**Window creation (macOS translucency + on-top):**

```js
const win = new BrowserWindow({
  width: 420, height: 68, frame: false, transparent: true, resizable: false,
  vibrancy: 'popover', // or 'sidebar'
  visualEffectState: 'active',
  hasShadow: true
});
win.setAlwaysOnTop(true, 'floating'); // test levels across full-screen apps
```

*Use vibrancy judiciously and verify legibility against varied wallpapers.* ([Electron][8])

---

### Why these choices?

They align with platform conventions (system fonts, color-scheme, reduced motion) and Electron reality (drag regions, vibrancy, window lifecycle). That combination keeps Agent Max feeling native, fast, and professional—without fighting the OS. ([MDN Web Docs][1])


[1]: https://developer.mozilla.org/en-US/docs/Web/CSS/font-family?utm_source=chatgpt.com "font-family - CSS | MDN - Mozilla"
[2]: https://m2.material.io/design/layout/spacing-methods.html?utm_source=chatgpt.com "Spacing methods"
[3]: https://www.w3.org/TR/WCAG20-TECHS/G18.html?utm_source=chatgpt.com "G18: Ensuring that a contrast ratio of at least 4.5:1 exists ..."
[4]: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme?utm_source=chatgpt.com "color-scheme - CSS | MDN - Mozilla"
[5]: https://developer.mozilla.org/en-US/docs/Web/CSS/%40media/prefers-reduced-motion?utm_source=chatgpt.com "prefers-reduced-motion - CSS | MDN - Mozilla"
[6]: https://electronjs.org/es/docs/latest/tutorial/custom-window-interactions?utm_source=chatgpt.com "Custom Window Interactions"
[7]: https://electronjs.org/docs/latest/api/browser-window?utm_source=chatgpt.com "BrowserWindow"
[8]: https://electronjs.org/docs/latest/api/base-window?utm_source=chatgpt.com "BaseWindow"
[9]: https://developer.apple.com/design/human-interface-guidelines/materials?utm_source=chatgpt.com "Materials | Apple Developer Documentation"
