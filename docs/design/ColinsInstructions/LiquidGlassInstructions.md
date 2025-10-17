# Electron UI Guide — Liquid Glass Edition (Agent Max)

> A practical, end‑to‑end playbook for building performant, accessible, Apple‑style “liquid glass” UIs in Electron.

---

## 0) TL;DR Objectives

* **Look:** Semi‑transparent, layered, blurred glass with subtle rim‑light and gradient tints.
* **Feel:** Crisp text (always readable), smooth at 60fps on integrated GPUs, polished focus/hover states.
* **Fallbacks:** Respect user and OS settings; degrade to clean opaque when transparency is disabled or on unsupported platforms.

---

## 1) Platform Reality Check

Electron runs Chromium within a native window. True macOS vibrancy (NSVisualEffectView) can be enabled by **BrowserWindow vibrancy** and **visualEffectState** options, but CSS `backdrop-filter` also works for DOM‑level glass effects. Treat them as complementary:

* **Native vibrancy (window‑level):** Blurs the OS content behind your window.
* **CSS glass (DOM‑level):** Blurs your *own* window layers; gives fine‑grained control (cards, modals, bars).

**Rule of thumb:** Use native vibrancy for the *backdrop/frame*, then compose UI surfaces with CSS glass for hierarchy.

---

## 2) BrowserWindow Setup (macOS‑first)

Create a frameless, transparent window with vibrancy:

```ts
// main.ts
import { BrowserWindow } from 'electron'

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    show: false,                // avoid white flash; show when ready
    frame: false,               // custom chrome
    transparent: true,          // allows glass
    vibrancy: 'under-window',   // macOS material; try 'sidebar', 'fullscreen-ui'
    visualEffectState: 'active',// tie material to window focus state
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#00000000', // ensure alpha channel
    trafficLightPosition: { x: 12, y: 12 }, // if you expose them
    webPreferences: {
      backgroundThrottling: false,
      spellcheck: true,
      // enable/disable features as needed
    }
  })

  win.once('ready-to-show', () => win.show())
  win.loadURL(process.env.ELECTRON_START_URL!)
}
```

**Notes**

* `transparent: true` and an **RGBA** `backgroundColor` with `00` alpha prevents white underlays.
* `frame: false` gives you full control. Add keyboard accelerators (Cmd+W, Esc) for escape hatches.
* If you don’t want full vibrancy, remove `vibrancy` and rely on CSS glass only.

---

## 3) Core CSS “Liquid Glass” Recipes

These utility classes use **backdrop blur**, **border hairlines**, **gradient rims**, and **tint layers**.

```css
:root {
  --glass-bg: hsla(0 0% 100% / 0.12);
  --glass-stroke: hsla(0 0% 100% / 0.10);
  --glass-rim1: hsla(0 0% 100% / 0.35);
  --glass-rim2: hsla(0 0% 100% / 0.00);
  --glass-shadow: 0 10px 30px rgba(0,0,0,0.25);
  --blur: 18px;                 /* 14–20px is the sweet spot */
  --saturation: 1.25;           /* slight pop */
}

/***** Base glass surface *****/
.glass {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: saturate(var(--saturation)) blur(var(--blur));
  -webkit-backdrop-filter: saturate(var(--saturation)) blur(var(--blur));
  box-shadow: var(--glass-shadow);
  border: 1px solid var(--glass-stroke); /* hairline */
  border-radius: 16px;
}

/***** Subtle rim‑light at the top *****/
.glass::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    var(--glass-rim1) 0%,
    var(--glass-rim2) 40%
  );
}

/***** Muted accent button *****/
.btn-glass {
  background: linear-gradient(
    180deg,
    hsla(210 20% 98% / 0.35),
    hsla(210 20% 92% / 0.20)
  );
  backdrop-filter: blur(calc(var(--blur) * 0.5));
  border: 1px solid hsla(0 0% 100% / 0.22);
  border-radius: 999px;
  padding: 10px 16px;
  transition: transform .12s ease, background .2s ease;
}
.btn-glass:hover { transform: translateY(-1px); }
.btn-glass:active { transform: translateY(0); }

/***** Inputs on glass *****/
.input-glass {
  background: hsla(0 0% 100% / 0.30);
  border: 1px solid hsla(0 0% 100% / 0.35);
  border-radius: 12px;
  backdrop-filter: blur(calc(var(--blur) * 0.6));
}
.input-glass:focus { outline: 2px solid rgba(255,255,255,0.8); outline-offset: 1px; }
```

### Accessibility toggles

Respect user preferences and provide a hard toggle.

```css
@media (prefers-reduced-transparency: reduce) {
  .glass, .btn-glass, .input-glass {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(255,255,255,0.92);
    box-shadow: none;
  }
}
```

---

## 4) Hierarchy Patterns (What to make glassy)

* **Backdrop layer:** a soft, low‑opacity glass to separate app from desktop.
* **Primary panels/cards:** medium opacity, stronger blur, hairline borders, subtle rim gradient.
* **Secondary surfaces (menus, tooltips):** lighter opacity, smaller blur, faster show/hide.
* **Text & icons:** solid colors; never translucent; maintain WCAG contrast.

**Don’t** blur everything. A few layers create hierarchy. Too many blur backdrops lead to muddy text and high GPU cost.

---

## 5) Performance Budget & Profiling

* **Target:** ≤2–3ms/frame for all blur layers combined on an M‑series or integrated Intel iGPU.
* **Reduce composition cost:**

  * Limit full‑screen blur to one element (the backdrop). Use smaller blurs for inner cards.
  * Avoid animating `backdrop-filter` itself. Animate opacity/transform of pre‑blurred layers.
  * Prefer opacity/transform for transitions; they stay on the compositor path.
* **Audit:**

  * Chromium DevTools → Performance: record interactions; inspect paint/composite time.
  * Toggle a “Glass Off” mode to compare frame timings.

---

## 6) Known Electron Quirks & Fixes

1. **White background leaks with transparent windows**

* Ensure `backgroundColor: '#00000000'` on BrowserWindow and `html, body { background: transparent; }` in CSS.
* Delay `win.show()` until `ready-to-show`.

2. **Backdrop blur + vibrancy oddities**

* Some Electron/Chromium builds exhibit z‑order quirks when layering `backdrop-filter` over native vibrancy. Workaround: keep DOM blur layers *inside* a non‑transparent container, and let window vibrancy handle the outermost backdrop.

3. **Titlebar and shadows**

* Frameless windows can show unexpected shadows/glows with transparency. Add `hasShadow: true` and a matching outer drop shadow in CSS; avoid fully transparent edges beyond the rounded radius.

4. **Click‑through regions**

* With irregular shapes, mark non‑interactive areas as `pointer-events: none;`. In the main process, you can also use `setIgnoreMouseEvents(true, { forward: true })` for pass‑through overlays.

5. **High‑DPI rendering**

* Use vector assets or 2x/3x PNGs. Mind `image-rendering` for pixel art. Test HiDPI + scaling.

6. **Platform fallbacks**

* **Windows:** Prefer Acrylic/Mica‑like CSS (or keep a clean opaque theme). Respect OS “Transparency effects” off.
* **Linux:** Many WMs lack blur; default to an opaque minimal theme.

7. **Accessibility conflicts**

* Offer a visible toggle: *Appearance → Transparency*. Also gate with `prefers-reduced-transparency`.

---

## 7) Light Mode that Still Feels “Futuristic”

* Increase base opacity a bit (0.20–0.28). Use cooler tints for panels (blue‑gray) and warm rim lights sparingly.
* Keep text near pure black on light glass. Don’t rely on blur for contrast.
* Use soft inner shadow for depth (very low radius, low alpha).

---

## 8) Component Cookbook

### Glass Card

```html
<div class="glass p-4">
  <h3>Card Title</h3>
  <p>Opaque text on translucent surface. Keep contrast ≥ 4.5:1.</p>
</div>
```

### Toolbar / Float Bar

```html
<div class="glass" style="border-radius: 999px; padding: 8px 12px; display:flex; gap:8px; align-items:center;">
  <button class="btn-glass">Run</button>
  <button class="btn-glass">Stop</button>
</div>
```

### Input on Glass

```html
<input class="input-glass" placeholder="Search" />
```

### Tabs on Glass (Pills)

```html
<nav class="glass" style="padding:6px; display:flex; gap:6px;">
  <button class="btn-glass" aria-selected="true">Overview</button>
  <button class="btn-glass" aria-selected="false">Screen</button>
  <button class="btn-glass" aria-selected="false">History</button>
</nav>
```

---

## 9) Interaction & Motion Guidelines

* **Micro‑motion only:** 120–180ms eases; tiny translate/opacity changes. Avoid blur radius animation.
* **Hover/focus:** Elevate with rim gradient + slight opacity shift. Always keep visible focus rings on keyboard nav.
* **Sound:** Optional subtle UI sounds at low volume; never mask screen readers.

---

## 10) Cross‑Platform Strategy

* **macOS (Primary):** BrowserWindow vibrancy + CSS glass for surfaces.
* **Windows 11:** Provide a **“Windows Material”** theme using CSS approximations of Mica/Acrylic (opaque base with noise/tint; translucent for transient surfaces). Auto‑disable when “Transparency effects” off.
* **Linux:** Clean opaque theme (same shapes/spacing). Keep the brand; drop the translucency.

Provide a user toggle: `Theme → Transparency: Auto / On / Off`.

---

## 11) Accessibility & Contrast

* Target **AA** contrast: 4.5:1 for normal text (3:1 large text). Do not render text with opacity < 1 on glass.
* Inputs and focus states need at least **3:1 non‑text contrast** for visible boundaries.
* Test with color‑blind filters and high contrast modes.

---

## 12) Testing Checklist

* [ ] Startup: no white flashes; window shows after ready.
* [ ] 60fps while typing/scrolling; no jank on tab changes.
* [ ] Transparency toggle switches instantly; respects OS settings.
* [ ] Keyboard: Tab order logical; focus rings visible on glass.
* [ ] Screen readers: Names/roles/states correct.
* [ ] macOS + Windows + Linux screenshots recorded for regression.

---

## 13) Troubleshooting Quick Wins

* **Blurs are expensive** → reduce area; composite one large backdrop + small local blurs.
* **Text looks washed out** → increase glass base opacity and reduce blur radius beneath text.
* **Random white frame** → verify alpha in `backgroundColor`; wait for `ready-to-show`.
* **Fuzzy edges** → ensure CSS background isn’t double‑compositing; avoid nested `backdrop-filter` stacks.
* **Click misses** → audit `pointer-events` and draggable regions.

---

## 14) Guardrails for Contributors

* Ban classes like `bg-gray-900`/heavy opaque fills in glass contexts.
* Provide `ui/glass.css` utilities; require use via ESLint rule + codemod suggestions.
* PR checklist must include perf and a11y screenshots and a 15‑sec trace.

---

## 15) Example: Minimal App Skeleton

```ts
// main.ts
const win = new BrowserWindow({
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  vibrancy: 'under-window',
  visualEffectState: 'active'
})
```

```html
<!-- index.html -->
<body class="backdrop">
  <div class="glass app-shell">
    <header class="glass toolbar">Agent Max</header>
    <main class="content">
      <!-- your panels here -->
    </main>
  </div>
</body>
```

```css
/* app.css */
html, body { height: 100%; background: transparent; }
.backdrop { position: fixed; inset: 0; }
.app-shell { margin: 16px; padding: 12px; }
.toolbar { border-radius: 12px; padding: 8px 12px; }
.content { margin-top: 12px; }
```

---

## 16) Future Enhancements

* Use color‑mix() for dynamic tints based on wallpaper tone when available.
* GPU‑friendly noise textures layered above glass for realism (static PNG, not animated).
* Prefer variable fonts with optical sizing to preserve clarity on glass.

---

## 17) Definition of Done

* Glass theme passes a11y checks, maintains 60fps in common flows, and has platform‑appropriate fallbacks.
* No visual flashes at startup; no white seams; stable shadows.
* Contributors have utilities and lint rules preventing regressions.

---

**Appendix: Quick Reference**

* Window: `transparent`, `backgroundColor: '#00000000'`, `frame: false`, optional `vibrancy`, `visualEffectState`.
* CSS: `backdrop-filter` for surfaces; hairline borders; rim gradients; no translucent text.
* A11y: `prefers-reduced-transparency`; AA/AAA contrast; visible focus; keyboard complete.
* Perf: limit blur area; do not animate blur radius; profile before/after.
