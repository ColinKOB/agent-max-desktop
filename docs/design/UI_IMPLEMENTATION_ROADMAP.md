# Agent Max — UI Implementation Roadmap

> A phased approach to implementing the Agent Max Brand Guide across the desktop application.

---

## Current State Analysis

### ✅ What's Already Working
- Mini pill mode (68×68px)
- Horizontal bar mode (320×68px)
- Card mode (360×520px)
- Draggable windows with Electron
- System font usage
- Backdrop blur infrastructure
- Component structure in FloatBar.jsx

### ❌ What Needs to Change
- **Color theme** - Dark (#0f1115) → Light (#F7F9FB)
- **Accent color** - Blue (#7aa2ff) → Teal (#0FB5AE)
- **Spacing** - Mixed px → 8pt grid
- **Typography** - Inconsistent → Defined scale
- **Design tokens** - Hardcoded → CSS variables
- **Contrast** - Dark theme → WCAG AA light theme
- **Motion** - 140ms → 150-220ms
- **Components** - Update all to brand style

---

## Implementation Phases

### Phase 1: Foundation & Design Tokens (2-3 hours)

**Goal:** Establish core design system

#### Tasks:
- [ ] Create `/src/styles/tokens.css` with brand variables
- [ ] Update `/src/styles/globals.css` for light theme
- [ ] Update `/tailwind.config.js` with teal accent
- [ ] Add 8pt spacing scale
- [ ] Set up `color-scheme` and `prefers-reduced-motion`

**Success Criteria:**
- ✅ CSS variables match brand guide
- ✅ No hardcoded colors
- ✅ 8pt spacing enforced

---

### Phase 2: Typography & Text Hierarchy (1-2 hours)

**Goal:** Consistent typography across app

#### Tasks:
- [ ] Verify system font stack
- [ ] Create typography utility classes:
  - Display (28px / 1.2 / 600)
  - Title (22px / 1.3 / 600)
  - Body (16px / 1.5 / 400)
  - Caption (13px / 1.4 / 400)
  - Mono (13px / 1.6 / 400)
- [ ] Apply to all components
- [ ] Add letter-spacing to headings (-0.2px)

**Success Criteria:**
- ✅ All text uses defined scale
- ✅ No font-loading jank
- ✅ Proper hierarchy

---

### Phase 3: Light Theme & Colors (2-3 hours)

**Goal:** Transform to light theme

#### Color Updates:
```css
--bg: #F7F9FB          (was: #0f1115)
--surface: #FFFFFF     (was: dark gray)
--border: #E5EAF0      (was: transparent white)
--text: #0B1220        (was: white)
--muted: #49566A       (was: transparent white)
--accent: #0FB5AE      (was: blue)
```

#### Component Updates:
- [ ] Mini pill: white translucent
- [ ] Bar mode: white translucent
- [ ] Card mode: light surface
- [ ] Shadows: lighter for light theme
- [ ] WCAG AA contrast check

**Success Criteria:**
- ✅ Light theme default
- ✅ Brand colors everywhere
- ✅ AA contrast passed

---

### Phase 4: Spacing & Layout (2-3 hours)

**Goal:** 8pt spacing grid

#### Spacing Variables:
```css
--space-0: 0
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 24px
--space-6: 32px
--space-7: 40px
```

#### Updates:
- [ ] Replace all hardcoded spacing
- [ ] Button heights: 28, 36, 44px
- [ ] Message padding: 12-16px
- [ ] Message gap: 12-16px
- [ ] Panel padding: consistent

**Success Criteria:**
- ✅ All spacing on 4/8px grid
- ✅ No arbitrary values
- ✅ Consistent rhythm

---

### Phase 5: Component Styling (3-4 hours)

**Goal:** Rebuild primitives per brand

#### Components:
- [ ] **Buttons**: Primary (teal fill), Secondary (border)
- [ ] **Inputs**: 12px radius, accent focus ring
- [ ] **Cards**: 12px radius, subtle hover elevation
- [ ] **Icon buttons**: 32-44px, visible focus rings

**Success Criteria:**
- ✅ Buttons match brand
- ✅ Proper focus states
- ✅ Min 44px hit targets

---

### Phase 6: Chat Interface (3-4 hours)

**Goal:** Refine chat UI

#### Updates:
- [ ] User bubbles: surface + border
- [ ] Agent bubbles: + 2px teal left rule
- [ ] Max message width: 760px
- [ ] Code blocks: full-width, copy button
- [ ] Composer: 64-88px, grows to 4 lines
- [ ] Empty state: practical examples

**Success Criteria:**
- ✅ 760px max width
- ✅ Accent left rule on agent
- ✅ Helpful empty state

---

### Phase 7: Animation & Motion (2 hours)

**Goal:** Brand-compliant motion

#### Timings:
```css
--duration-micro: 150ms
--duration-standard: 200ms
--duration-large: 240ms
--duration-enter: 320ms
--easing: cubic-bezier(.2,.8,.2,1)
```

#### Updates:
- [ ] Mini pill hover: scale 1.03, -2px
- [ ] Button animations: 150ms
- [ ] Reduced motion support
- [ ] Smooth state transitions

**Success Criteria:**
- ✅ 150-320ms animations
- ✅ Cubic-bezier easing
- ✅ Reduced motion works

---

### Phase 8: Electron-Specific macOS (2-3 hours)

**Goal:** Native feel on macOS

#### Tasks:
- [ ] Vibrancy: 'popover' or 'sidebar'
- [ ] Test on varied wallpapers
- [ ] Graceful window show
- [ ] Always-on-top levels
- [ ] Verify drag regions

**Success Criteria:**
- ✅ Vibrancy works
- ✅ Text readable everywhere
- ✅ No white-flash
- ✅ Drag regions perfect

---

### Phase 9: Accessibility & QA (2-3 hours)

**Goal:** WCAG AA compliance

#### Tasks:
- [ ] Contrast audit (4.5:1 minimum)
- [ ] Keyboard navigation complete
- [ ] Hit targets ≥44px
- [ ] Screen reader testing
- [ ] Motion preference testing

**Success Criteria:**
- ✅ WCAG AA passed
- ✅ Full keyboard nav
- ✅ Visible focus rings

---

### Phase 10: Polish & Testing (2-3 hours)

**Goal:** Final refinements

#### Tasks:
- [ ] Cross-platform testing (macOS/Windows/Linux)
- [ ] Responsive breakpoints
- [ ] Edge cases (long text, errors)
- [ ] Performance check (60fps)
- [ ] Brand compliance final check

**Success Criteria:**
- ✅ Works on all platforms
- ✅ No bugs or glitches
- ✅ Smooth performance
- ✅ Brand guide matched

---

## Timeline

| Phase | Duration |
|-------|----------|
| Phase 1: Foundation | 2-3h |
| Phase 2: Typography | 1-2h |
| Phase 3: Colors | 2-3h |
| Phase 4: Spacing | 2-3h |
| Phase 5: Components | 3-4h |
| Phase 6: Chat UI | 3-4h |
| Phase 7: Animation | 2h |
| Phase 8: Electron | 2-3h |
| Phase 9: A11y & QA | 2-3h |
| Phase 10: Polish | 2-3h |
| **Total** | **22-30h** |

**Realistic:** 1-1.5 weeks  
**With testing:** 2 weeks

---

## Design Tokens Quick Reference

```css
/* Colors */
--bg: #F7F9FB;
--surface: #FFFFFF;
--subsurface: #F1F4F8;
--border: #E5EAF0;
--text: #0B1220;
--muted: #49566A;
--accent: #0FB5AE;
--accent-hover: #0AA099;

/* Spacing */
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;

/* Radii */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-pill: 999px;

/* Motion */
--duration-standard: 200ms;
--easing: cubic-bezier(.2,.8,.2,1);
```

---

## Success Metrics

1. Visual fidelity ≥95% match to brand guide
2. WCAG AA compliance 100%
3. 60fps animations
4. Zero hardcoded colors/spacing
5. Cross-platform consistency

---

*Last updated: 2025-01-14*
