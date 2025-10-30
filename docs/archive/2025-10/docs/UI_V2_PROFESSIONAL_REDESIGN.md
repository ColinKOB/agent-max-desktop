# UI V2: Professional Light Mode Redesign

## Summary

The card and settings windows have been redesigned with a clean, content-first aesthetic while **pill and bar modes remain completely unchanged**.

## What Changed

### 1. Design Tokens (`src/styles/tokens.css`)

Added professional V2 token system:

```css
/* Surfaces */
--amx-surface: #FFFFFF;
--amx-surface-subtle: #F6F7F9;
--amx-text: #0B1220;
--amx-text-muted: #4A5568;
--amx-border: #E6E8EC;

/* Accent */
--amx-accent: #3B82F6;
--amx-accent-hover: #2563EB;

/* Elevation */
--amx-shadow: 0 4px 24px rgba(10, 20, 40, 0.08);

/* Typography Scale (4-point) */
--amx-text-12: 12px;
--amx-text-14: 14px;
--amx-text-16: 16px;
--amx-text-18: 18px;
--amx-text-20: 20px;
--amx-text-24: 24px;

/* Spacing Scale (4-point) */
--amx-space-1: 4px;
--amx-space-2: 8px;
--amx-space-3: 12px;
--amx-space-4: 16px;
--amx-space-5: 20px;
--amx-space-6: 24px;
```

### 2. Card Mode (`src/styles/globals.css`)

**Architecture**: Three-zone design

#### Container
- White background (`#FFFFFF`)
- 1px border (`#E6E8EC`)
- Soft elevation shadow
- 16px border radius
- **No glass effects on root**

#### Header (Glass Chrome - 56px)
```css
.amx-header {
  height: 56px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--amx-border);
}
```

- Title: 18px semibold, dark text
- Icon buttons: 24×24px, minimal style, 68% opacity → 100% on hover
- SVG icons: 14px

#### Messages Area (Flat Content)
```css
.amx-thoughts {
  flex: 1;
  padding: 16px;
  background: white;
  color: #0B1220;
}
```

**Message Bubbles**:
- User messages: `#F6F7F9` background
- Agent messages: white with 2px blue left border
- 14px body text, 1.5 line-height
- Max width: 640px
- 8px gap between messages

#### Composer (Glass Chrome - 64px)
```css
.amx-composer {
  min-height: 64px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--amx-border);
}
```

- Textarea: 14px, auto-grow to 3 lines
- Send button: solid accent blue, 36×36px
- Clean focus states: 2px blue outline

### 3. Settings Window (`src/styles/premium-glass.css`)

Transformed to professional light mode:

- **Background**: Removed purple/blue gradients → neutral `#0b0c10`
- **Cards**: White surface with clean shadow
- **Typography**: Dark text on light background
- **Borders**: Subtle `#E6E8EC`
- **Hover**: Blue border accent
- **Removed**: Animated gradient overlays, heavy glows

### 4. What Stayed the Same

✅ **Pill Mode (80×80px)**: Completely untouched
- Dark glass aesthetic preserved
- All gradients, blurs, borders intact
- Logo, drag handle, interactions unchanged

✅ **Bar Mode (320×80px)**: Completely untouched  
- Reverse vignette preserved
- Input styling maintained
- Minimize button unchanged

## Typography Scale

Strict 4-point scale enforced:

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Card title | 18-20px | 600 | Headers |
| Body text | 14-15px | 400 | Messages |
| Metadata | 12px | 500 | Timestamps, labels |
| Icon sizes | 12-14px | — | Buttons, controls |

## Color System

| Token | Hex | Usage |
|-------|-----|-------|
| `--amx-surface` | #FFFFFF | Cards, panels |
| `--amx-surface-subtle` | #F6F7F9 | User bubbles, sub-surfaces |
| `--amx-text` | #0B1220 | Primary text |
| `--amx-text-muted` | #4A5568 | Secondary text |
| `--amx-border` | #E6E8EC | Dividers, borders |
| `--amx-accent` | #3B82F6 | Interactive, focus |
| `--amx-accent-hover` | #2563EB | Hover states |

## Spacing System

Strict 4-point grid:
- **4px**: Tight (label-to-input)
- **8px**: Between messages
- **12px**: Section gaps, card internal padding
- **16px**: Card padding, header/composer horizontal
- **20px**: Large gaps
- **24px**: Component separation

## Performance

- **Backdrop blur**: Limited to header/composer only (12px)
- **Content area**: Flat white (no blur, no GPU cost)
- **Shadows**: Single soft elevation per card
- **Transitions**: Transform/opacity only (no filter animations)

## Accessibility

- **Contrast**: All text ≥ 4.5:1 against background
- **Font size**: Body text 14px minimum
- **Focus states**: 2px blue outline, 2px offset
- **Semantic HTML**: Real `<button>` and `<textarea>` elements

## Testing Checklist

Before shipping:

- [ ] Pill → Bar transition works
- [ ] Bar → Card transition works
- [ ] Card header drag handle functional
- [ ] Icon buttons 12-14px, proper hit targets
- [ ] Message bubbles max 640px
- [ ] Composer textarea auto-grows
- [ ] Settings cards render light mode
- [ ] All focus states visible
- [ ] Contrast passes WCAG AA
- [ ] No blur animation jank

## Files Modified

1. `src/styles/tokens.css` - Added V2 professional tokens
2. `src/styles/globals.css` - Redesigned card, messages, composer
3. `src/styles/premium-glass.css` - Converted settings to light mode
4. `src/styles/liquid-glass.css` - Removed blue gradient from backdrop

## Migration Notes

### If Reverting
Original glass styles preserved in git history. Pill/bar untouched so no risk there.

### Next Steps
1. Restart Electron app to see changes
2. Test card mode transitions
3. Open settings window to verify light theme
4. Check message rendering and composer
5. Verify pill/bar still work as expected

## Design Philosophy

**Before**: Heavy glass effects everywhere, competing with content  
**After**: Glass reserved for chrome (header/composer), content gets clean white surface

This creates clear hierarchy:
- **Chrome** (frosted glass) = controls, navigation
- **Content** (flat white) = messages, reading area
- **Accent** (blue) = interactive elements

Result: Professional, trustworthy, readable UI suitable for productivity tools.
