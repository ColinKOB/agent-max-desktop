# Phase C: Testing & Validation Guide

**Duration:** 30-60 minutes  
**Goal:** Verify glass CSS recipe meets all performance and accessibility budgets before touching production code.

---

## 🧪 Test Environment Setup

### Prerequisites
- [x] `test-glass-ui.html` opened in browser
- [ ] Chrome DevTools installed
- [ ] Axe DevTools extension installed ([Get it here](https://www.deque.com/axe/devtools/))
- [ ] Color contrast analyzer ready

---

## ✅ C.1: Visual Verification (5 min)

### Open Test File
```bash
# Should already be open - if not:
open test-glass-ui.html
```

### What to Check

#### ✓ Glass Panel Appearance
- [ ] Panels have **frosted glass** look (not flat/opaque)
- [ ] Background gradient **shows through** with blur
- [ ] **Rim light** visible at top edge of panels (subtle white glow)
- [ ] **Color tints** visible (blue → violet → orange gradient overlay)
- [ ] Panels feel **layered** with depth

#### ✓ Input Fields
- [ ] Inputs have **glass background** (semi-transparent)
- [ ] Placeholder text is **visible but muted** (rgba(255,255,255,0.45))
- [ ] Click into input: **focus glow appears** (white outline)
- [ ] Text you type is **clearly readable** (rgba(255,255,255,0.95))

#### ✓ Buttons
- [ ] Button has **gradient shine** (lighter at top)
- [ ] Hover: Button **lifts up** slightly (translateY(-1px))
- [ ] Click: Button **presses down** (scale(0.98))
- [ ] **No lag** during hover/click animations

#### ✓ Status Badge
- [ ] Badge has **green glow** (rgba(34,197,94,0.15) bg)
- [ ] Dot pulses/glows appropriately
- [ ] Text is **high contrast** (readable)

**Pass Criteria:** All visual checks ✓ → Proceed to C.2

---

## 📊 C.2: Performance Budget Validation (15 min)

### Step 1: Open DevTools
```
1. Right-click page → Inspect
2. Go to "Performance" tab
3. Click record button (●)
```

### Test A: Scroll Performance
```
1. Click "Start Recording"
2. Scroll up and down smoothly for 5 seconds
3. Stop recording
4. Analyze results
```

**Budget Check:**
- [ ] **Frame Rate:** Solid 60fps (green line, no red drops)
- [ ] **Compositor Time:** ≤2-3ms per frame (check "Compositor" in timeline)
- [ ] **Layerize:** Max 3-4 compositing layers visible
- [ ] **No purple bars** (layout thrashing)

**How to check compositor time:**
1. In Performance tab, zoom into a frame
2. Look for "Composite Layers" tasks
3. Hover to see duration - should be ≤3ms

### Test B: Hover Performance
```
1. Start recording
2. Hover button rapidly 10 times
3. Stop recording
4. Check timeline
```

**Budget Check:**
- [ ] **No filter/backdrop-filter** in transition (should only see opacity/transform)
- [ ] Button hover completes in <120ms
- [ ] No frame drops during hover

### Test C: Focus Performance
```
1. Start recording
2. Tab through all inputs (3 fields + 1 button)
3. Stop recording
```

**Budget Check:**
- [ ] Focus ring appears **instantly** (no animation delay)
- [ ] No backdrop-filter animation triggered
- [ ] Keyboard events < 10ms response time

### 📸 Take Screenshots
```bash
# Save performance traces for PR documentation
# DevTools → Performance → Right-click timeline → Save profile...
# Name: glass-perf-scroll-test.json
# Name: glass-perf-hover-test.json
# Name: glass-perf-focus-test.json
```

**Pass Criteria:** All budgets met → Proceed to C.3

**If Failed:**
- Reduce blur amount (14px → 12px)
- Simplify gradient overlays
- Check for too many nested blur layers

---

## ♿ C.3: Accessibility Audit (15 min)

### Axe DevTools Scan
```
1. Open DevTools → Axe DevTools tab
2. Click "Scan ALL of my page"
3. Wait for results
```

**Budget Check:**
- [ ] **Score ≥95** (target: 100)
- [ ] **0 Critical issues**
- [ ] **0 Serious issues**
- [ ] Minor issues documented with justification

### Manual Contrast Checks

#### Test Spot 1: Panel Title on Busy Background
```
1. Right-click panel title
2. Inspect → Computed styles
3. Check color: rgba(255,255,255,0.95)
4. Use contrast checker against blurred background
```
**Required:** 4.5:1 minimum (AA for normal text)

#### Test Spot 2: Input Placeholder Text
```
Color: rgba(255,255,255,0.45)
Background: rgba(255,255,255,0.12)
```
**Required:** 3:1 minimum (AA for large text/UI components)

#### Test Spot 3: Button Text
```
Color: rgba(255,255,255,0.95)
Background: linear-gradient (averaged ~rgba(255,255,255,0.23))
```
**Required:** 3:1 minimum

**Tools:**
- Online: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- macOS: Digital Color Meter (Cmd+Space → "Digital Color Meter")
- Chrome: DevTools → Inspect → Contrast ratio shown in color picker

### Keyboard Navigation Test
```
1. Click in address bar (to reset focus)
2. Press Tab repeatedly
3. Watch focus ring move through:
   - Input 1
   - Input 2
   - Input 3 (password)
   - Button
```

**Check:**
- [ ] Focus ring **clearly visible** at every step
- [ ] Focus ring has **2px width** with rgba(255,255,255,0.6)
- [ ] No focus ring **cutoff** by overflow:hidden
- [ ] Can activate button with **Enter/Space**

### Reduced Transparency Test
```
1. macOS: System Settings → Accessibility → Display → Reduce transparency
2. Windows: Settings → Personalization → Colors → Transparency effects: Off
3. Refresh test page
```

**Expected Behavior:**
- [ ] Page still renders (no crashes)
- [ ] Glass falls back to **opaque alternative**
- [ ] Typography/spacing **unchanged**
- [ ] Still readable and usable

**Pass Criteria:** Axe ≥95, all contrast checks pass, keyboard nav works → Proceed to C.4

---

## 📷 C.4: Cross-Platform Screenshots (10 min)

### Required Screenshots

#### macOS (Primary Platform)
```
1. Light theme + transparency ON
   - Screenshot: glass-macos-light.png
2. Dark theme + transparency ON
   - Screenshot: glass-macos-dark.png
3. Transparency OFF (Reduce transparency: ON)
   - Screenshot: glass-macos-opaque.png
```

#### Windows 11 (if available)
```
1. Transparency effects ON
   - Screenshot: glass-windows-on.png
2. Transparency effects OFF
   - Screenshot: glass-windows-off.png
```

#### Linux (if available)
```
1. Default theme (expect opaque fallback)
   - Screenshot: glass-linux-opaque.png
```

### How to Take Screenshots
```bash
# macOS
Cmd+Shift+4 → Select area → Saves to Desktop

# Windows
Win+Shift+S → Select area

# Linux
gnome-screenshot --area
```

**Pass Criteria:** Screenshots show consistent layout across platforms → Proceed to C.5

---

## 🔧 C.5: Token Adjustment (if needed)

### If Performance Budget Failed

**Reduce blur amount:**
```css
/* In globals.css - .amx-settings-panel */
backdrop-filter: blur(14px) saturate(1.2);
/* Change to: */
backdrop-filter: blur(12px) saturate(1.2);
```

**Simplify gradient:**
```css
/* Remove one gradient layer if needed */
background:
  /* Remove radial gradient if too expensive */
  linear-gradient(150deg, rgba(82,146,255,0.12), rgba(122,83,255,0.10)),
  rgba(255,255,255,0.06);
```

### If Contrast Failed

**Increase text opacity:**
```css
/* Panel titles */
color: rgba(255, 255, 255, 0.95); /* → 0.98 */

/* Body text */
color: rgba(255, 255, 255, 0.80); /* → 0.85 */
```

**Increase background opacity:**
```css
/* Panels */
rgba(255, 255, 255, 0.06); /* → 0.08 */
```

### If Keyboard Focus Invisible

**Strengthen focus ring:**
```css
.amx-input-glass:focus {
  outline: 2px solid rgba(255, 255, 255, 0.40); /* → 0.60 */
  outline-offset: 2px;
}
```

---

## ✅ Exit Criteria Checklist

Before committing PR0, ALL must be checked:

### Visual
- [ ] Glass panels render correctly
- [ ] Blur and gradients visible
- [ ] Rim lighting present
- [ ] Inputs/buttons styled properly

### Performance
- [ ] Scroll: 60fps, ≤3ms compositor
- [ ] Hover: No filter animation, <120ms
- [ ] Focus: Instant, no animation
- [ ] Frame traces saved for PR

### Accessibility
- [ ] Axe DevTools score ≥95
- [ ] 3 contrast checks documented (ratios recorded)
- [ ] Keyboard navigation works
- [ ] Reduced transparency fallback works

### Cross-Platform
- [ ] macOS screenshots (light/dark/opaque)
- [ ] Windows screenshots (if available)
- [ ] Linux screenshots (if available)

---

## 🚀 Next Steps

### If ALL Exit Criteria Pass:
```bash
# Stage changes
git add src/styles/globals.css
git add test-glass-ui.html
git add src/config/featureFlags.js
git add eslint-plugin-amx/
git add .stylelintrc.json

# Commit PR0
git commit -m "feat(glass): Add liquid glass utility system

- Add .amx-settings-panel and supporting glass utilities
- Add .amx-input-glass, .amx-btn-glass form components
- Add .amx-stat-card, .amx-tag-glass, .amx-status-badge
- Add feature flag system (GLASS_SETTINGS, GLASS_PROFILE_CARD)
- Add ESLint rule: amx/no-opaque-in-glass
- Add Stylelint config: ban filter/backdrop-filter animation
- Add standalone test harness: test-glass-ui.html

Performance: ✓ ≤3ms compositor, 60fps scroll
Accessibility: ✓ Axe 95+, WCAG AA contrast
Cross-platform: ✓ macOS/Windows/Linux tested

Budgets documented in LIQUID_GLASS_EXECUTION_PLAN.md"

# Create branch
git checkout -b feature/glass-foundation
```

### If Any Criteria Fail:
1. Document failure in `LIQUID_GLASS_EXECUTION_PLAN.md`
2. Adjust tokens per C.5 guidance
3. Re-run failed tests
4. Do NOT proceed to Phase B until green

---

## 📋 Test Results Template

Copy this to execution plan after testing:

```markdown
### Phase C Results (Date: _______)

**Visual:** ✅ / ❌  
**Performance:**
- Scroll: ✅ / ❌ (___ms compositor)
- Hover: ✅ / ❌ 
- Focus: ✅ / ❌

**Accessibility:**
- Axe Score: ___/100
- Contrast Checks:
  - Panel title: ___ (required: 4.5:1)
  - Input placeholder: ___ (required: 3:1)
  - Button text: ___ (required: 3:1)
- Keyboard nav: ✅ / ❌
- Reduced transparency: ✅ / ❌

**Cross-Platform:**
- macOS: ✅ / ❌
- Windows: ✅ / ❌ / N/A
- Linux: ✅ / ❌ / N/A

**Decision:** PROCEED / ADJUST / BLOCK
```

---

**Good luck! 🚀**
