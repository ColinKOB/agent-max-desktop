# Glass UI Pull Request

## Summary
<!-- Brief description of what changed and why. Link to LIQUID_GLASS_EXECUTION_PLAN.md section if applicable. -->


## Budgets
<!-- Fill in actual numbers from test runs -->

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| **Performance** |
| Blur compositor time | __ ms | ≤3ms | ⏳ |
| Dropped frames | __ | 0 | ⏳ |
| **Accessibility** |
| Axe/Lighthouse score | __ | ≥95 | ⏳ |
| Manual contrast checks | __:1 (worst case) | 4.5:1 | ⏳ |
| **Visual** |
| Pixel diff % | __% | ≤0.1% | ⏳ |


## Screenshots
<!-- Attach screenshots for each platform/mode -->

### macOS
- [ ] Light theme, transparency ON
- [ ] Dark theme, transparency ON
- [ ] Transparency OFF (reduced transparency mode)

### Windows (if available)
- [ ] Transparency effects ON
- [ ] Transparency effects OFF

### Linux (if available)
- [ ] Opaque fallback


## Feature Flags
<!-- Check all that apply and were tested -->

- [ ] `GLASS_UI_ENABLED` tested (on/off)
- [ ] `GLASS_SETTINGS` tested (on/off)
- [ ] `GLASS_PROFILE_CARD` tested (on/off)
- [ ] `GLASS_FORCE_OPAQUE` emergency override tested


## CI Checks
<!-- These will be auto-populated by GitHub Actions -->

- [ ] ESLint (no opaque classes in glass contexts)
- [ ] Stylelint (no filter/backdrop-filter animations)
- [ ] Accessibility (Axe ≥95)
- [ ] Visual Regression (diff ≤0.1%)
- [ ] Performance Budget (≤3ms compositor)


## Manual Testing Checklist

- [ ] Tested on macOS with transparency ON
- [ ] Tested on macOS with transparency OFF (System Settings → Accessibility → Display → Reduce transparency)
- [ ] Keyboard navigation works (visible focus rings)
- [ ] Text is readable (passed contrast check)
- [ ] No white flashes on load
- [ ] Animations use only opacity/transform (no filter)
- [ ] Glass panels have proper depth/layering


## Rollback Plan
<!-- How to quickly revert if issues found in production -->

1. Set `GLASS_FORCE_OPAQUE=1` in environment variables
2. Or revert this commit: `git revert <commit-sha>`


## Additional Notes
<!-- Any relevant context, known issues, or follow-up work -->


---

**Refs:** LIQUID_GLASS_EXECUTION_PLAN.md Phase [C/B/A]
