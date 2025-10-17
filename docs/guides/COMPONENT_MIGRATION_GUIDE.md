# Component Migration Guide

**Purpose:** Step-by-step guide to migrate each component from current dark theme to brand-compliant light theme.

---

## Migration Strategy

### Before & After Pattern

For each component, follow this process:

1. **Audit current styles** - Document what's hardcoded
2. **Replace with tokens** - Use CSS variables
3. **Update Tailwind classes** - Use new brand utilities
4. **Test visually** - Compare to brand guide
5. **Test functionally** - Ensure no breakage

---

## Priority Order

Migrate in this order (most visible first):

1. **Mini Pill** - First thing users see
2. **Bar Mode Input** - Most used interaction
3. **Chat Bubbles** - Core experience
4. **Buttons** - Everywhere
5. **Header** - Always visible
6. **Composer** - Critical input
7. **Toast Notifications** - Feedback
8. **Welcome Screen** - Onboarding

---

## 1. Mini Pill (68×68px)

### Current State (Dark)
```css
.amx-mini {
  background: hsla(220, 0%, 0%, 0.85);  /* Almost black */
  border: 1px solid hsl(0, 0%, 0%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

### Target State (Light)
```css
.amx-mini {
  background: hsla(0, 0%, 100%, 0.92);  /* White with translucency */
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(var(--blur-amount)) saturate(115%);
}
```

### Changes in `globals.css`
```css
.amx-mini {
  /* Keep existing positioning/layout */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* UPDATE THESE */
  border-radius: var(--radius-lg);  /* 16px, was 0 */
  background: hsla(0, 0%, 100%, var(--glass-opacity));
  backdrop-filter: blur(var(--blur-amount)) saturate(115%);
  -webkit-backdrop-filter: blur(var(--blur-amount)) saturate(115%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg);
  
  /* Keep existing interaction */
  cursor: pointer;
  transition: all var(--duration-base) var(--ease-base);
  padding: var(--space-3);
  overflow: hidden;
  pointer-events: all;
  user-select: none;
  -webkit-user-select: none;
  -webkit-app-region: drag;
}

/* Hover state */
.amx-mini:hover {
  transform: scale(1.03) translateY(-2px);
  box-shadow: var(--shadow-xl);
}

/* Active/pressed state */
.amx-mini:active {
  transform: scale(0.98);
}
```

### Test Cases
- [ ] Pill appears white/light on light wallpapers
- [ ] Pill appears white/light on dark wallpapers
- [ ] Text/logo is visible (high contrast)
- [ ] Shadow is visible but subtle
- [ ] Hover animation smooth (scale + translateY)
- [ ] Click animation smooth (scale down)
- [ ] Draggable still works

---

## 2. Bar Mode Input (320×68px)

### Current State
```css
.amx-bar {
  background: hsla(220, 0%, 0%, 0.85) !important;
  border: 1px solid hsla(0, 0%, 100%, 0.08) !important;
}

.amx-bar-input {
  color: hsla(0, 0%, 100%, 0.85);
}

.amx-bar-input::placeholder {
  color: hsla(0, 0%, 100%, 0.5);
}
```

### Target State
```css
.amx-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}

.amx-bar-input {
  color: var(--text);
  font-size: var(--text-body-size);
}

.amx-bar-input::placeholder {
  color: var(--muted);
  opacity: 0.6;
}
```

### Changes in `globals.css`
```css
.amx-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);  /* 12px, was hardcoded */
  padding: 0 var(--space-3) 0 var(--space-5);  /* 0 12px 0 24px */
  
  /* UPDATED */
  border-radius: var(--radius-lg);
  background: var(--surface);
  backdrop-filter: blur(var(--blur-amount)) saturate(115%);
  -webkit-backdrop-filter: blur(var(--blur-amount)) saturate(115%);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  transition: all var(--duration-base) var(--ease-base);
}

.amx-bar-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: var(--text-body-size);  /* 16px */
  font-weight: var(--weight-regular);  /* 400 */
  letter-spacing: var(--tracking-normal);
  -webkit-app-region: no-drag;
}

.amx-bar-input::placeholder {
  color: var(--muted);
  opacity: 0.6;
  font-weight: var(--weight-regular);
}

.amx-bar-input:focus {
  outline: none;
}
```

### Minimize Button
```css
.amx-bar-minimize-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--button-md);  /* 36px */
  height: var(--button-md);
  border-radius: var(--radius-pill);  /* Full circle */
  background: var(--subsurface);  /* Light gray */
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  transition: all var(--duration-micro) var(--ease-base);
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.amx-bar-minimize-btn:hover {
  background: var(--border);  /* Slightly darker */
  color: var(--text);
  transform: scale(1.05);
}

.amx-bar-minimize-btn:active {
  transform: scale(0.95);
}
```

### Test Cases
- [ ] Bar background is light/white
- [ ] Input text is dark and readable
- [ ] Placeholder is muted gray
- [ ] Minimize button visible and clickable
- [ ] Focus state works (no ugly outline)
- [ ] Still draggable except on input
- [ ] Smooth transition from mini to bar

---

## 3. Chat Bubbles

### User Message Bubble

**Current:**
```css
.amx-message-user .amx-message-content {
  background: var(--bubble);  /* Dark translucent */
  border: 1px solid var(--stroke);  /* Nearly invisible */
  color: var(--text);  /* White */
}
```

**Target:**
```css
.amx-message-user .amx-message-content {
  background: var(--surface);  /* White */
  border: 1px solid var(--border);  /* Visible light gray */
  color: var(--text);  /* Dark text */
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

**Updated CSS:**
```css
.amx-message-user .amx-message-content {
  padding: var(--space-3) var(--space-4);  /* 12px 16px */
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  font-size: var(--text-body-size);  /* 16px */
  line-height: var(--text-body-lh);  /* 1.5 */
}
```

### Agent Message Bubble

**Key difference:** Add 2px teal left rule for scannability

```css
.amx-message-agent .amx-message-content {
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);  /* ← ACCENT LEFT RULE */
  color: var(--text);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  font-size: var(--text-body-size);
  line-height: var(--text-body-lh);
}
```

### Thought/Debug Bubbles

**Keep slightly different for hierarchy:**
```css
.amx-message-thought .amx-message-content {
  padding: var(--space-2) var(--space-3);  /* Smaller */
  background: var(--subsurface);  /* Light gray, not white */
  border: 1px dashed var(--border);  /* Dashed, not solid */
  color: var(--muted);  /* Muted text */
  font-style: italic;
  font-size: var(--text-caption-size);  /* 13px */
  opacity: 0.85;
}
```

### Test Cases
- [ ] User bubbles: white bg, dark text, visible border
- [ ] Agent bubbles: white bg + teal left rule
- [ ] Thought bubbles: light gray, dashed, italic
- [ ] All text readable (WCAG AA contrast)
- [ ] Max width 760px enforced
- [ ] Gap between messages consistent (12-16px)

---

## 4. Buttons

### Primary Button (Accent Fill)

```css
.btn-primary,
.amx-btn-primary {
  height: var(--button-md);  /* 36px */
  padding: 0 var(--space-4);  /* 0 16px */
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #FFFFFF;  /* White text on teal */
  border: none;
  font-size: var(--text-body-size);
  font-weight: var(--weight-semibold);  /* 600 */
  cursor: pointer;
  transition: all var(--duration-micro) var(--ease-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);  /* For icon + text */
}

.btn-primary:hover {
  background: var(--accent-hover);  /* Darken 6% */
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  background: var(--accent-press);  /* Darken 10% */
  transform: scale(0.98);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

### Secondary Button (Border Style)

```css
.btn-secondary,
.amx-btn-secondary {
  height: var(--button-md);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  font-size: var(--text-body-size);
  font-weight: var(--weight-medium);  /* 500 */
  cursor: pointer;
  transition: all var(--duration-micro) var(--ease-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.btn-secondary:hover {
  background: var(--subsurface);  /* Light gray fill */
  border-color: var(--accent);
  transform: translateY(-1px);
}

.btn-secondary:active {
  transform: scale(0.98);
}

.btn-secondary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### Icon Button

```css
.amx-icon-btn {
  width: var(--button-lg);  /* 44px for accessibility */
  height: var(--button-lg);
  border-radius: var(--radius-sm);  /* 8px, not full circle */
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  transition: all var(--duration-micro) var(--ease-base);
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

.amx-icon-btn:hover {
  background: var(--subsurface);
  color: var(--text);
  border-color: var(--accent);
}

.amx-icon-btn:active {
  transform: scale(0.95);
}

.amx-icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### Test Cases
- [ ] Primary: Teal bg, white text, legible
- [ ] Primary hover: Darker teal, lifts up
- [ ] Secondary: Border only, light fill on hover
- [ ] Icon buttons: 44×44px minimum (accessibility)
- [ ] All buttons have visible focus rings
- [ ] Disabled state clear (50% opacity)

---

## 5. Header

```css
.amx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);  /* 48px */
  padding: 0 var(--space-4);
  font-weight: var(--weight-semibold);
  font-size: var(--text-title-size);  /* 22px */
  color: var(--text);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
}

.amx-header-title {
  font-size: var(--text-title-size);
  font-weight: var(--weight-semibold);
  color: var(--text);
  letter-spacing: var(--tracking-tight);  /* -0.2px */
}

.amx-header-actions {
  display: flex;
  gap: var(--space-2);
  -webkit-app-region: no-drag;
}
```

---

## 6. Composer (Input Area)

```css
.amx-compose {
  display: flex;
  align-items: flex-end;  /* Align to bottom as input grows */
  gap: var(--space-2);  /* 8px */
  padding: var(--space-3);
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.amx-input {
  flex: 1;
  min-height: var(--composer-min-height);  /* 64px */
  max-height: var(--composer-max-height);  /* 88px (4 lines) */
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--subsurface);  /* Light gray */
  border: 1px solid var(--border);
  color: var(--text);
  font-size: var(--text-body-size);
  line-height: var(--text-body-lh);
  resize: none;  /* Don't allow manual resize */
  overflow-y: auto;
  transition: all var(--duration-fast) var(--ease-base);
  -webkit-app-region: no-drag;
}

.amx-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(15, 181, 174, 0.1);  /* Teal glow */
}

.amx-input::placeholder {
  color: var(--muted);
  opacity: 0.6;
}
```

---

## 7. Toast Notifications

**Update in `App.jsx`:**

```jsx
<Toaster
  position="bottom-right"
  toastOptions={{
    duration: 3000,
    style: {
      background: 'var(--surface)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      fontSize: 'var(--text-body-size)',
    },
    success: {
      iconTheme: {
        primary: 'var(--success)',
        secondary: '#FFFFFF',
      },
    },
    error: {
      style: {
        background: 'var(--danger)',
        color: '#FFFFFF',
      },
    },
  }}
/>
```

---

## Quick Migration Checklist

For ANY component you're migrating:

1. **Find hardcoded colors**
   - Search for `#` in the file
   - Search for `rgb`, `rgba`, `hsl`, `hsla`
   
2. **Replace with tokens**
   - Background: `var(--surface)` or `var(--bg)`
   - Text: `var(--text)` or `var(--muted)`
   - Borders: `var(--border)`
   - Accent: `var(--accent)`
   
3. **Update spacing**
   - Find all `padding`, `margin`, `gap`
   - Replace with `var(--space-X)`
   
4. **Update typography**
   - Font sizes: `var(--text-X-size)`
   - Line heights: `var(--text-X-lh)`
   - Weights: `var(--weight-X)`
   
5. **Update animations**
   - Duration: `var(--duration-X)`
   - Easing: `var(--ease-base)`
   
6. **Test contrast**
   - Use WebAIM contrast checker
   - Ensure 4.5:1 minimum

---

## Testing Commands

```bash
# Start dev server
npm run electron:dev

# Check for hardcoded colors (should find minimal results)
grep -r "rgb\|rgba\|hsl\|#[0-9a-fA-F]" src/styles/ src/components/

# Check for hardcoded spacing (px values)
grep -r "[0-9]px" src/styles/ | grep -v "var("
```

---

*Component Migration Guide - Use alongside phase implementations*
