# Phase 1: Design Tokens Implementation

**Goal:** Create the foundation CSS variables that all components will use.

---

## File to Create: `/src/styles/tokens.css`

```css
/**
 * Agent Max Design Tokens
 * Based on UI_BRAND_GUIDE.md and UI_BRAND_GUIDE_2.md
 * 
 * Usage: Import this file FIRST in main.jsx or index.html
 * All components should reference these variables, never hardcode values.
 */

:root {
  /* ==========================================
     COLORS - Light Theme (Default)
     Following brand guide section 2.3
     ========================================== */
  
  /* Backgrounds */
  --bg: #F7F9FB;              /* Main background */
  --surface: #FFFFFF;         /* Cards, panels, primary surface */
  --subsurface: #F1F4F8;      /* Secondary surface, subtle distinction */
  
  /* Borders & Dividers */
  --border: #E5EAF0;          /* Standard border color */
  
  /* Text */
  --text: #0B1220;            /* Primary text (dark) */
  --muted: #49566A;           /* Secondary text, labels */
  
  /* Accent & Interactive */
  --accent: #0FB5AE;          /* Primary teal accent */
  --accent-hover: #0AA099;    /* Hover state (6% darker) */
  --accent-press: #099188;    /* Active/pressed state (10% darker) */
  
  /* Status Colors */
  --danger: #D13B3B;          /* Errors, destructive actions */
  --warning: #B86E00;         /* Warnings, caution */
  --success: #1D966A;         /* Success states, confirmations */
  
  /* ==========================================
     SPACING - 8-Point Grid
     Following brand guide section 2.2
     Base unit: 8px
     ========================================== */
  
  --space-0: 0;
  --space-1: 4px;    /* Tight spacing only (half unit) */
  --space-2: 8px;    /* Base unit */
  --space-3: 12px;   /* 1.5× base */
  --space-4: 16px;   /* 2× base */
  --space-5: 24px;   /* 3× base */
  --space-6: 32px;   /* 4× base */
  --space-7: 40px;   /* 5× base */
  --space-8: 48px;   /* 6× base (for headers) */
  
  /* ==========================================
     BORDER RADIUS
     Following brand guide section 2.2
     ========================================== */
  
  --radius-sm: 8px;     /* Small elements, pills, tags */
  --radius-md: 12px;    /* Standard buttons, inputs, cards */
  --radius-lg: 16px;    /* Large panels, windows */
  --radius-pill: 999px; /* Circular elements */
  
  /* ==========================================
     TYPOGRAPHY
     Following brand guide section 2.1
     Font: System UI stack (no webfonts)
     ========================================== */
  
  /* Font Families */
  --font-base: system-ui, -apple-system, "Segoe UI", Roboto, "Inter", 
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, 
               "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", 
               "Courier New", monospace;
  
  /* Font Sizes */
  --text-display-size: 28px;    /* Large headings */
  --text-title-size: 22px;      /* Section titles */
  --text-body-size: 16px;       /* Primary body text */
  --text-caption-size: 13px;    /* Small text, labels */
  --text-mono-size: 13px;       /* Code blocks */
  
  /* Line Heights */
  --text-display-lh: 1.2;       /* Tight for headings */
  --text-title-lh: 1.3;         /* Slightly tight */
  --text-body-lh: 1.5;          /* Readable body text */
  --text-caption-lh: 1.4;       /* Compact small text */
  --text-mono-lh: 1.6;          /* Spacious for code */
  
  /* Font Weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  
  /* Letter Spacing */
  --tracking-tight: -0.2px;     /* Headings ≥22px */
  --tracking-normal: 0;
  --tracking-wide: 0.5px;       /* All caps labels */
  
  /* ==========================================
     SHADOWS & ELEVATION
     Light theme shadows (subtle)
     ========================================== */
  
  /* Small elevation (hover states) */
  --shadow-sm: 0 2px 8px rgba(11, 18, 32, 0.08);
  
  /* Medium elevation (cards, buttons) */
  --shadow-md: 0 4px 12px rgba(11, 18, 32, 0.10);
  
  /* Large elevation (modals, dropdowns) */
  --shadow-lg: 0 8px 24px rgba(11, 18, 32, 0.16);
  
  /* Extra large (main window) */
  --shadow-xl: 0 10px 40px rgba(11, 18, 32, 0.12);
  
  /* Inner glow/highlight */
  --shadow-inner: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  
  /* ==========================================
     ANIMATION & MOTION
     Following brand guide section 2.4
     ========================================== */
  
  /* Durations */
  --duration-instant: 0ms;       /* No animation */
  --duration-micro: 150ms;       /* Small state changes */
  --duration-fast: 180ms;        /* Quick transitions */
  --duration-base: 200ms;        /* Standard transitions */
  --duration-slow: 240ms;        /* Size/position changes */
  --duration-slower: 320ms;      /* Enter/exit animations */
  
  /* Easing Functions */
  --ease-base: cubic-bezier(0.2, 0.8, 0.2, 1);  /* Brand standard */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);        /* Accelerate */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);       /* Decelerate */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);  /* Smooth both ends */
  
  /* ==========================================
     Z-INDEX SCALE
     Following brand guide section 7
     ========================================== */
  
  --z-base: 0;
  --z-overlay: 1000;     /* Overlays, dropdowns */
  --z-pill: 1100;        /* Float bar window */
  --z-modal: 1150;       /* Modal dialogs */
  --z-toast: 1200;       /* Toast notifications */
  --z-tooltip: 1300;     /* Tooltips */
  
  /* ==========================================
     LAYOUT CONSTRAINTS
     Following brand guide section 3
     ========================================== */
  
  /* Chat message max width */
  --message-max-width: 760px;
  
  /* Breakpoints (for media queries) */
  --breakpoint-compact: 1024px;
  --breakpoint-standard: 1440px;
  
  /* Container gutters */
  --gutter-compact: 24px;
  --gutter-standard: 32px;
  --gutter-spacious: 40px;
  
  /* Component heights */
  --header-height: 48px;
  --composer-min-height: 64px;
  --composer-max-height: 88px;
  --button-sm: 28px;
  --button-md: 36px;
  --button-lg: 44px;
  
  /* ==========================================
     GLASS EFFECTS (macOS)
     Following brand guide section 5
     ========================================== */
  
  --blur-amount: 12px;           /* Backdrop blur strength */
  --glass-opacity: 0.92;         /* Surface translucency */
  --glass-border: rgba(0, 0, 0, 0.06); /* Subtle border on glass */
}

/* ==========================================
   SYSTEM INTEGRATION
   Advertise color scheme support
   ========================================== */

:root {
  color-scheme: light dark;  /* Allows native scrollbars/controls to match */
}

/* ==========================================
   ACCESSIBILITY - Reduced Motion
   Following brand guide section 6
   ========================================== */

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-micro: 1ms;
    --duration-fast: 1ms;
    --duration-base: 1ms;
    --duration-slow: 1ms;
    --duration-slower: 1ms;
  }
  
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ==========================================
   DARK THEME (Future)
   Placeholder for dark theme support
   Currently not in scope per brand guide
   ========================================== */

@media (prefers-color-scheme: dark) {
  /* 
   * Dark theme would go here in a future phase
   * Brand guide focuses on light theme first
   */
}
```

---

## File to Update: `/src/styles/globals.css`

**Changes needed:**

1. **Import tokens at the top:**
```css
@import './tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

2. **Remove old color variables** from `:root` block (lines 19-91)

3. **Update base styles:**
```css
@layer base {
  html,
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-base);
    font-size: var(--text-body-size);
    line-height: var(--text-body-lh);
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

---

## File to Update: `/tailwind.config.js`

**Replace the entire theme.extend section:**

```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Keep for future dark theme
  theme: {
    extend: {
      colors: {
        // Brand colors from tokens
        'brand-bg': '#F7F9FB',
        'brand-surface': '#FFFFFF',
        'brand-subsurface': '#F1F4F8',
        'brand-border': '#E5EAF0',
        'brand-text': '#0B1220',
        'brand-muted': '#49566A',
        'brand-accent': {
          DEFAULT: '#0FB5AE',
          hover: '#0AA099',
          press: '#099188',
        },
        'brand-danger': '#D13B3B',
        'brand-warning': '#B86E00',
        'brand-success': '#1D966A',
      },
      spacing: {
        // 8-point grid
        '0': '0',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '24px',
        '6': '32px',
        '7': '40px',
        '8': '48px',
      },
      borderRadius: {
        'brand-sm': '8px',
        'brand-md': '12px',
        'brand-lg': '16px',
        'brand-pill': '999px',
      },
      fontSize: {
        'display': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'title': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'mono': ['13px', { lineHeight: '1.6', fontWeight: '400' }],
      },
      transitionDuration: {
        'micro': '150ms',
        'fast': '180ms',
        'base': '200ms',
        'slow': '240ms',
        'slower': '320ms',
      },
      transitionTimingFunction: {
        'brand': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      boxShadow: {
        'brand-sm': '0 2px 8px rgba(11, 18, 32, 0.08)',
        'brand-md': '0 4px 12px rgba(11, 18, 32, 0.10)',
        'brand-lg': '0 8px 24px rgba(11, 18, 32, 0.16)',
        'brand-xl': '0 10px 40px rgba(11, 18, 32, 0.12)',
      },
    },
  },
  plugins: [],
}
```

---

## Testing Checklist

After implementing Phase 1, verify:

- [ ] `/src/styles/tokens.css` created with all variables
- [ ] `globals.css` imports tokens.css first
- [ ] Old color variables removed from globals.css
- [ ] `tailwind.config.js` updated with brand colors
- [ ] No console errors when app runs
- [ ] Background is now light (#F7F9FB) not dark
- [ ] Text is dark (#0B1220) not light
- [ ] All CSS variables are accessible via `var(--variable-name)`

**Test in browser console:**
```js
getComputedStyle(document.documentElement).getPropertyValue('--accent')
// Should return: "#0FB5AE" or " #0FB5AE"
```

---

## Next Steps

After Phase 1 is complete:
- Move to Phase 2 (Typography)
- Start replacing hardcoded colors with `var(--color-name)`
- Replace hardcoded spacing with `var(--space-X)`
- Update components one by one

---

## Common Pitfalls

1. **Don't forget the space:** `var(--accent)` needs space in some contexts
2. **Import order matters:** tokens.css MUST come before other styles
3. **Tailwind purge:** New classes won't work until dev server restarts
4. **Variable naming:** Use exact names from tokens.css, typos won't error

---

*Phase 1 of 10 - Estimated time: 2-3 hours*
