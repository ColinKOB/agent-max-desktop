# Liquid Glass UI Compliance — Atomic Execution Plan

**Created:** October 16, 2025  
**Revised:** October 17, 2025 (Senior-grade rigor applied)  
**Status:** 🟡 IN PROGRESS  
**Rollout Strategy:** C → B → A (Test → ProfileCard → Settings slices)

---

## 📊 Progress Overview

- **PRs Planned:** 6 atomic PRs
- **PRs Merged:** 0
- **Current Phase:** C (Testing & Validation)
- **Feature Flags:** Ready to implement

**Overall Progress:** ██░░░░░░░░ 10%

---

## 🎯 Hard Budgets (Non-Negotiable)

### Performance
- **Compositor Time:** ≤2–3 ms/frame total (M-series Mac + mid-tier Windows iGPU)
- **Blur Layers:** Max 1 full-viewport backdrop-filter + ≤2 nested component blurs
- **Frame Drops:** 0 dropped frames during scroll/hover/focus
- **Animation Budget:** Only opacity/transform animate (never filter/backdrop-filter)

### Accessibility
- **Contrast:** WCAG 2.1 AA minimum (4.5:1 normal text, 3:1 large text)
- **Keyboard Nav:** Visible focus rings (2px solid, rgba(255,255,255,0.6))
- **Reduced Motion:** `prefers-reduced-transparency` honored with opaque fallback
- **Lighthouse Score:** ≥95 accessibility

### Cross-Platform
- **macOS:** First-class vibrancy + backdrop-filter
- **Windows 11:** Detect "Transparency effects" toggle; fallback to opaque + tint
- **Linux:** Opaque mode (identical spacing/typography, no translucency assumed)

---

## 🚀 Atomic PR Strategy (C → B → A)

### **PR0: Foundation** ✅ READY FOR TESTING
**Branch:** `feature/glass-foundation` (not yet created)  
**Status:** ⏳ Awaiting Phase C validation  
**Files Changed:**
- `src/styles/globals.css` (+327 lines)
- `src/config/featureFlags.js` (NEW)
- `eslint-plugin-amx/` (NEW - 3 files)
- `.stylelintrc.json` (NEW)
- `test-glass-ui.html` (NEW)
- `PHASE_C_TESTING_GUIDE.md` (NEW)
- `src/pages/Settings.jsx` (REVERTED to clean state)

**Deliverables:**
- [x] Glass utility classes (327 lines, lines 2269-2595)
- [x] Standalone test HTML with visual inspection guide
- [x] ESLint rule: `amx/no-opaque-in-glass` (prevents bg-gray-* in glass contexts)
- [x] Stylelint config: Bans filter/backdrop-filter animation
- [x] Feature flag system with 5 flags + emergency override
- [x] Phase C testing guide (comprehensive 15-page manual)

**Acceptance Criteria (Before Commit):**
- [ ] Phase C.1: Visual verification ✓
- [ ] Phase C.2: Performance trace (≤3ms compositor, 60fps)
- [ ] Phase C.3: Axe accessibility ≥95
- [ ] Phase C.4: Cross-platform screenshots
- [ ] Phase C.5: Token adjustments (if needed)

**Next Action:** User executes PHASE_C_TESTING_GUIDE.md

---

### **Phase C: Testing & Validation** ⏳ IN PROGRESS
**Duration:** 30-60 min  
**Goal:** Verify glass recipe before touching app code

**Tasks:**
- [ ] C.1: Open `test-glass-ui.html` in browser (DONE - awaiting user verification)
- [ ] C.2: DevTools performance trace
  - Scroll test: 0 dropped frames
  - Hover test: compositor time ≤3ms
  - Focus test: no backdrop-filter animation
- [ ] C.3: Accessibility audit
  - Run Axe DevTools extension
  - Manual contrast check on 3 worst cases
  - Keyboard navigation (Tab through all inputs)
- [ ] C.4: Cross-platform screenshots
  - macOS: Light/dark, transparency on
  - Windows: Transparency on/off (if available)
  - Linux: Opaque fallback
- [ ] C.5: Adjust tokens if any budget fails

**Exit Criteria:** All budgets green → Commit PR0

---

### **Phase B: ProfileCard Conversion** ⏳ PENDING
**Branch:** `feature/glass-profile-card`  
**PR:** #TBD  
**Files:** `src/components/ProfileCard.jsx`  
**Size:** 91 lines (small blast radius)

**Changes:**
- Remove: All `bg-gray-*`, `dark:bg-gray-*`, `text-gray-*`
- Add: `.amx-stat-card` for stat containers
- Add: `.amx-tag-glass` for preference tags
- Replace: Manual styling with glass utilities

**Acceptance Criteria:**
- [ ] Screenshots (macOS/Windows/Linux, light/dark)
- [ ] Playwright visual snapshot (diff ≤0.1%)
- [ ] DevTools trace attached
- [ ] Axe/Lighthouse a11y ≥95
- [ ] Manual contrast notes for 3 tricky spots

**Exit Criteria:** PR merged with green CI checks

---

### **Phase A: Settings (Sliced, Behind Flag)** ⏳ PENDING
**Feature Flag:** `GLASS_SETTINGS=0|1` (default 0)  
**Escape Hatch:** `GLASS_FORCE_OPAQUE=1` (hotfix override)

#### **A1: Settings — Appearance Section**
**Branch:** `feature/glass-settings-appearance`  
**PR:** #TBD  
**Files:** `src/pages/Settings.jsx` (Theme section only)

**Changes:**
- Wrap Theme section in `<div className={glassEnabled ? 'amx-settings-panel' : 'card'}>`
- Replace theme buttons with glass styling
- Keep all other sections unchanged

**Acceptance Criteria:** Same as Phase B

#### **A2: Settings — API Configuration**
**Branch:** `feature/glass-settings-api`  
**Changes:** API section only

#### **A3: Settings — Screen Control**
**Branch:** `feature/glass-settings-screen`

#### **A4-A7:** Remaining sections (Subscription, Google, Data, About)

---

### ✅ Phase 2: Global Text Color Migration
**Priority:** 🔴 CRITICAL | **Status:** ⏳ PENDING

- [ ] **Task 2.1:** ProfileCard.jsx text migration
  - Replace all `text-gray-*` with white opacity scale
  - Status: PENDING

- [ ] **Task 2.2:** AgentDashboard.jsx text migration (if needed beyond recent changes)
  - Status: PENDING

- [ ] **Task 2.3:** ChatHistory.jsx text migration
  - Status: PENDING

- [ ] **Task 2.4:** SettingsApp.jsx text migration
  - Status: PENDING

---

### ✅ Phase 3: Glass Input Component
**Priority:** 🔴 CRITICAL | **Status:** ⏳ PENDING

- [ ] **Task 3.1:** Create `.amx-input-glass` utility class
  - Location: `src/styles/globals.css`
  - Include focus states and placeholder styles
  - Status: PENDING

- [ ] **Task 3.2:** Create `.amx-btn-glass` utility class
  - Primary and secondary variants
  - Status: PENDING

- [ ] **Task 3.3:** Apply to Settings inputs
  - Replace all generic input classes
  - Status: PENDING

---

## 🎯 Week 2 — Component Refinement (Oct 21-25)

### ✅ Phase 4: ProfileCard Glass Treatment
**Priority:** 🟡 MAJOR | **Status:** ⏳ PENDING

- [ ] **Task 4.1:** Create `.amx-stat-card` glass class
  - Status: PENDING

- [ ] **Task 4.2:** Remove all `bg-gray-*` backgrounds
  - Status: PENDING

- [ ] **Task 4.3:** Replace tag backgrounds with glass
  - Status: PENDING

---

### ✅ Phase 5: Scrollbar & Accessibility
**Priority:** 🟡 MAJOR | **Status:** ⏳ PENDING

- [ ] **Task 5.1:** Update scrollbar colors for dark glass
  - Status: PENDING

- [ ] **Task 5.2:** Improve `prefers-reduced-transparency`
  - Status: PENDING

---

## 🎯 Week 3 — Polish & QA (Oct 26-30)

### ✅ Phase 6: Final Cleanup
**Priority:** 🟢 MINOR | **Status:** ⏳ PENDING

- [ ] **Task 6.1:** Add ESLint rules (ban `bg-gray-*`)
  - Status: PENDING

- [ ] **Task 6.2:** Cross-browser testing
  - Status: PENDING

- [ ] **Task 6.3:** Accessibility audit
  - Status: PENDING

---

## 📝 Change Log

### [Oct 17, 2025 12:05 AM] — Senior-Grade Rigor Applied
**Restructure:** Shifted from narrative to atomic execution
- Replaced monolithic tasks with 6 atomic PRs (C → B → A strategy)
- Added hard performance/a11y budgets (non-negotiable)
- Created feature flag system with emergency override
- Added guardrails: ESLint + Stylelint rules
- Created comprehensive testing protocol (Phase C guide)

**Blocker Resolved:** Settings.jsx syntax errors
- **Action Taken:** `git checkout src/pages/Settings.jsx` (reverted to clean)
- **Rationale:** Settings too large for single sweep; will slice behind flags in Phase A

**Infrastructure Added:**
1. `src/config/featureFlags.js` — Runtime flag management
   - 5 feature flags: GLASS_UI_ENABLED, GLASS_SETTINGS, GLASS_PROFILE_CARD, etc.
   - Emergency override: GLASS_FORCE_OPAQUE
   - Dev toggle: GLASS_DEV_TOGGLE
   
2. `eslint-plugin-amx/` — Design system enforcement
   - Rule: `no-opaque-in-glass` (bans bg-gray-* in glass contexts)
   - Auto-detects glass wrappers (amx-*-glass, amx-settings-panel, etc.)
   
3. `.stylelintrc.json` — Performance guardrails
   - Bans animating filter/backdrop-filter (forces opacity/transform only)
   - Ignores Tailwind @-rules
   
4. `PHASE_C_TESTING_GUIDE.md` — Validation protocol
   - 5 test phases: Visual, Perf (3 traces), A11y (Axe + manual), Cross-platform, Adjustment
   - Explicit pass/fail criteria per budget
   - Screenshot templates with naming conventions

### [Oct 16, 2025 11:54 PM]
**Initial Implementation:** Glass utility classes created
- Added 327 lines of CSS to `globals.css` (lines 2269-2595)
- Classes: `.amx-settings-panel`, `.amx-input-glass`, `.amx-btn-glass`, `.amx-status-badge`, `.amx-stat-card`, `.amx-tag-glass`
- Test harness: `test-glass-ui.html` (standalone, no React dependencies)

---

## 🧪 Testing Checklist

### ✅ Completed Tests:
- [x] Glass CSS utilities compile without errors
- [x] Test HTML file created
- [x] Feature flag system verified (8/8 checks passed)
- [x] ESLint plugin structure validated
- [x] Stylelint config verified
- [x] Phase C testing guide validated
- [x] Settings.jsx reverted to clean state
- [x] Verification script created and passing

**Verification:** `./verify-phase-c-ready.sh` — ✅ 8/8 passed (Exit code: 0)

### ⏳ Pending Tests (User Action Required):
- [ ] Open test-glass-ui.html in browser
- [ ] Visual comparison with FloatBar reference
- [ ] Blur performance (< 2-3ms per frame)
- [ ] Text contrast ratio (AA minimum 4.5:1)
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Reduced transparency mode works
- [ ] No white flashes on load

---

## 🚨 Blockers & Risks

### Active Blockers:
1. **Settings.jsx Syntax Errors** (Task 1.2)
   - Unclosed div tags at line 130
   - Incomplete conversion causing parse errors
   - **Solution:** Either revert to original or complete conversion
   - **Priority:** HIGH - prevents Settings app from loading

### Risks:
- Multi_edit approach prone to syntax errors on large files
- May need different approach for complex component refactors

---

**Last Updated:** Oct 16, 2025 11:54 PM
**Updated By:** Cascade AI
