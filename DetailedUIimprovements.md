# Agent Max UI — Glass Minimal UI Spec

**Summary:** Minimal, futuristic, readable. Window = light glass; messages/inputs = thicker glass. One accent color. Three phases (Pill → Bar → Card) with tasteful motion and progressive growth. Implement the tokens and acceptance criteria below exactly.

---

## 0) Success criteria (high level)

* Text is always readable (WCAG ≥ 4.5:1) on busy wallpapers.
* Only one accent color is used everywhere.
* Panel reads as subtle glass (not a flat gray slab): visible blur, faint hairline, soft shadow.
* Bubbles/inputs are visibly thicker glass than the panel.
* Pill → Bar → Card transitions are fast, unobtrusive, and free of bounce.
* The Card grows as conversation length increases; only messages scroll when capped.

---

## 1) Design principles

* **Subtle glass**: low-contrast frosted panel, hairline borders, soft shadows. No neon.
* **Consistency**: two radius tiers, one accent, 8‑pt spacing grid, unified focus ring.
* **Restraint**: fewer colors, softer motion, less chrome; clarity over ornament.

---

## 2) Tokens (single source of truth)

Create `src/ui/tokens.css`:

```css
:root{
  /* Colors */
  --panel: hsla(220 14% 18% /.50);      /* window glass */
  --bubble: hsla(220 14% 18% /.82);     /* bubbles & inputs */
  --stroke: hsla(0 0% 100% /.06);       /* hairline border */
  --text: hsla(0 0% 100% /.94);
  --muted: hsla(0 0% 100% /.64);
  --accent: hsl(228 100% 74%);          /* unified accent */
  --glow: hsla(228 100% 74% /.18);

  /* Effects */
  --blur: 20px;
  --shadow-win: 0 10px 40px rgba(0,0,0,.28);
  --shadow-elt: 0 6px 18px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04);

  /* Radii & spacing */
  --r-panel: 16px;    /* window */
  --r-elt: 12px;      /* bubbles, inputs, buttons */
  --space-1: 8px; --space-2: 12px; --space-3: 16px; --space-4: 24px;

  /* Motion */
  --ease: cubic-bezier(.2,.8,.2,1);
  --t-fast: 140ms; --t-med: 180ms;
}
```

**Acceptance**: All styles reference these variables; no hardcoded duplicates.

---

## 3) Electron window configuration

Create/verify `electron/main.ts`:

```ts
import { app, BrowserWindow } from 'electron'

function createWindow(){
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  })
  win.setRoundedCorners?.(true)
  win.loadURL(process.env.VITE_DEV_SERVER_URL ?? `file://${__dirname}/index.html`)
}
app.whenReady().then(createWindow)
```

**Acceptance**:

* macOS uses vibrancy; Windows/Linux simulate glass only via CSS.
* Window background truly transparent (`#00000000`).

---

## 4) Global base styles

Create `src/ui/base.css`:

```css
@import './tokens.css';

html, body, #root { height: 100%; background: transparent; color: var(--text); }
* { box-sizing: border-box; }

.window.glass {
  background: var(--panel);
  backdrop-filter: saturate(115%) blur(var(--blur));
  -webkit-backdrop-filter: saturate(115%) blur(var(--blur));
  border: 1px solid var(--stroke);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-win);
  transition: all var(--t-med) var(--ease);
}

.bubble, .input, .ghost-btn {
  background: var(--bubble);
  border: 1px solid var(--stroke);
  border-radius: var(--r-elt);
  box-shadow: var(--shadow-elt);
}

.input:focus-visible, .ghost-btn:focus-visible {
  outline: 0; box-shadow: 0 0 0 2px var(--accent);
}

.label { color: var(--muted); letter-spacing: .02em; font-weight: 600; }

.drag { -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }

/* Remove any skeuomorphic corner gloss */
.window::before { content: none; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
```

**Acceptance**: No bevel/gradient corner highlights; hairline borders present on panel and bubbles.

---

## 5) Phases & state machine

Create `src/ui/phase.ts`:

```ts
export type Phase = 'pill' | 'bar' | 'card'
```

Create `src/ui/usePhase.tsx`:

```tsx
import { useState, useLayoutEffect, useRef } from 'react'
import type { Phase } from './phase'

export function usePhase(){
  const [phase, setPhase] = useState<Phase>('pill')
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const toBar = () => setPhase('bar')
  const toCard = () => setPhase('card')

  function onMessagesChanged(messagesLen: number, isThinking: boolean){
    if (phase !== 'card') return
    const content = scrollRef.current?.scrollHeight ?? 0
    const fixedChrome = 160 /* header + footer approx */
    const target = Math.min(fixedChrome + content, 640)
    const el = cardRef.current
    if (!el) return
    el.animate([{ height: getComputedStyle(el).height }, { height: `${target}px` }], { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' })
    el.style.height = `${target}px`
  }

  return { phase, toBar, toCard, scrollRef, cardRef, onMessagesChanged }
}
```

**Acceptance**: Pill → Bar on click; Bar → Card on submit or when `isThinking` is true; Card height animates to fit content (cap 640px), messages area scrolls only when capped.

---

## 6) Phase specs (authoritative)

### A) Draggable Mini Pill

* **Size**: 72×72 px, radius 12 px.
* **Drag**: Entire tile draggable; interactive children marked `.no-drag`.
* **Hover**: `transform: translateY(-1px)`; shadow +10%.
* **Transition**: On click, morph to Mini Bar in ≤180 ms (scale/width + opacity).

**Must pass**

* Drag anywhere on the pill moves the window.
* Clicking (without drag) promotes to bar with no jitter.
* Logo is crisp at 2× scale.

### B) Mini Bar

* **Size**: 420×72 px; panel radius 16 px.
* **Layout**: left padding 16, input consumes ≥80% width, ghost icon button on the right.
* **Placeholder**: “Ask Max…”.
* **Focus ring**: 2 px in `--accent`.
* **Promotion**: Submit or `isThinking` → Card.

**Must pass**

* Enter key or icon click promotes to Card and retains focus.
* Input remains readable on light/dark wallpaper.

### C) Chat Card (Progressive)

* **Width**: 420 px; **height** grows with content up to 640 px.
* **Header**: title + two ghost icon buttons; spacing grid (16 px outer, 8–12 px inner).
* **Messages**: bubbles radius 12 px; 8–12 px vertical spacing; sender labels muted.
* **System rows (“Thinking…”)**: lighter bubble (`opacity ~0.70`), no heavy shadow.
* **Footer**: input + optional camera icon; input height 48–52 px.

**Must pass**

* Height animates smoothly; no layout jump.
* After max height, only the messages area scrolls.

---

## 7) Components (minimal JSX)

Create `src/App.tsx` (simplified shell):

```tsx
import './ui/base.css'
import { usePhase } from './ui/usePhase'

export default function App(){
  const { phase, toBar, toCard, scrollRef, cardRef, onMessagesChanged } = usePhase()

  if (phase === 'pill') return (
    <div className="window glass drag" style={{ width:72, height:72 }} onClick={toBar}>
      {/* center logo here */}
    </div>
  )

  if (phase === 'bar') return (
    <div className="window glass drag" style={{ width:420, height:72 }}>
      <input className="input no-drag" placeholder="Ask Max…"
        onKeyDown={(e)=>{ if(e.key==='Enter'){ toCard() } }} />
      <button className="ghost-btn no-drag" onClick={toCard}/>
    </div>
  )

  // card
  return (
    <div ref={cardRef} className="window glass" style={{ width:420, height:560, padding:16 }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontWeight:600 }}>Hi, Colin</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="ghost-btn" style={{ width:32, height:32 }}/>
          <button className="ghost-btn" style={{ width:32, height:32 }}/>
        </div>
      </header>
      <div className="label" style={{ marginBottom:8 }}>Thinking</div>
      <section ref={scrollRef} style={{ overflow:'auto', display:'grid', gap:8, flex:1, minHeight:120 }}>
        <div className="bubble">Hello!</div>
        <div className="bubble" style={{ opacity:.9 }}><span style={{ color:'var(--muted)' }}>Agent Max</span> — how can I help you today?</div>
      </section>
      <footer style={{ display:'grid', gap:10, marginTop:12 }}>
        <input className="input" placeholder="Chat with Max" />
      </footer>
    </div>
  )
}
```

**Note**: Call `onMessagesChanged(messages.length, isThinking)` when you append messages to animate growth.

---

## 8) Micro‑interactions

Add to `base.css`:

```css
/* Subtle top-border activity indicator */
.thinking-bar{
  position: relative; height: 2px; overflow: hidden;
}
.thinking-bar::before{
  content:''; position:absolute; inset:0; width:120%;
  background: linear-gradient(90deg, transparent, var(--accent), #7ef3e6, transparent);
  animation: slide 1.2s linear infinite; opacity:.7;
}
@keyframes slide { from{ transform: translateX(-20%) } to{ transform: translateX(20%) } }

/* On window blur, gently raise bubble opacity for readability */
.window:has(:focus-within) .bubble{ opacity: .82 }
.window:not(:has(:focus-within)) .bubble{ opacity: .86 }
```

**Acceptance**: Indicator never turns into a rainbow marquee; motion respects `prefers-reduced-motion`.

---

## 9) Accessibility

* Keyboard order: input → send → menu buttons.
* Focus ring: 2 px accent on all interactive elements.
* Hit targets: ≥ 36×36 px.
* Reduced motion: disables height morphs and animations.

**Acceptance**: App can be fully operated with keyboard only; focus is always visible.

---

## 10) Platform fallbacks

* **macOS**: vibrancy + blur.
* **Windows/Linux**: no vibrancy; keep blur; if backgrounds are often bright, nudge `--panel` to `.56` for contrast.

**Acceptance**: Readability retained regardless of wallpaper brightness.

---

## 11) QA checklist (run after implementation)

* [ ] Pill: drag works anywhere; click promotes to Bar without accidental drag.
* [ ] Bar: Enter/Send promotes to Card and keeps input focus.
* [ ] Card: height animates; capped at 640; only messages scroll when capped.
* [ ] Contrast ≥ 4.5:1 for body text.
* [ ] Single accent color across the app.
* [ ] No corner gloss; faint hairlines visible on all glass surfaces.
* [ ] Focus rings consistent and visible.
* [ ] Reduced-motion honored; no bounce animations.

---

## 12) Implementation order

1. Add tokens and base styles.
2. Implement Pill with full drag region.
3. Implement Bar with input + promotion.
4. Implement Card shell, scroll area, and progressive height animation.
5. Replace all outlines/shadows with tokens; unify accent usage.
6. Add thinking indicator + blur/opacity focus tweaks.
7. Add platform fallbacks and reduced-motion handling.
8. Run QA checklist; fix failures.

---

## 13) Guardrails (do not do)

* No neon gradients or multicolor accents.
* No skeuomorphic corner gloss.
* No long dark shadows beneath bubbles or inputs.
* No multiple radius tiers or random spacings.

---

## 14) Optional polish

* Add a subtle 1–2% noise PNG overlay to the panel to prevent banding on large blurs.
* Slow the caret blink rate while `isThinking` is true.
* On window blur, slightly increase bubble opacity (+0.04) to preserve contrast.

---

**End of spec.** Apply exactly; if a choice isn’t defined, choose the more subtle option (lighter glass, softer motion, fewer colors).
