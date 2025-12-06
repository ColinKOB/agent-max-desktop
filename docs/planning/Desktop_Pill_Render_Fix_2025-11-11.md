# Desktop Pill Render Fix — Production Build

Date: 2025-11-11

## Symptom
- Packaged app showed a square/black mini window with odd teal/white bleed and DevTools URL was `chrome-error://chromewebdata/`.
- Body element rendered with default UA stylesheet (margin: 8px; 64×64) indicating the app UI was not loaded.

## Root Cause
- Electron production windows were trying to load `../dist/index.html` relative to `electron/main`, which resolves to `electron/dist/index.html` (non-existent).
- When `loadFile` fails, Chromium falls back to a `chrome-error://chromewebdata/` error page; with `transparent: true`, desktop wallpaper bleeds through, making the pill look incorrect.

## Fix
- Resolve the Vite build output once and reuse for all production windows.
- Added:
  - `const DIST_INDEX_HTML = path.resolve(__dirname, '..', '..', 'dist', 'index.html');`
- Switched `loadFile` calls to use `DIST_INDEX_HTML` for:
  - Main pill window (root route)
  - Card window (`#/card`)
  - Settings window (`#/settings` or provided route)

File: `electron/main/main.cjs`

## Why it works
- Vite outputs to `<repo>/dist/`. From `electron/main`, the correct relative path is `../../dist/index.html`.
- Using a single constant prevents future drift across windows.

## How to Verify
1. Build UI: `npm run build`
2. Run production-like Electron: `npm run electron:dev:prodlike`
3. The mini pill should appear with correct glass styling. Open DevTools (Cmd+Opt+I) and confirm URL is `file://.../dist/index.html` (not chrome-error).
4. Expand to bar and navigate to Settings (gear) to ensure hash routes load correctly.

## Notes
- The teal/white “halo” seen earlier was the desktop showing through a transparent window because the app content failed to load.
- No changes were required to CSS for the pill; this was a load-path issue.

## Next Steps
- If any assets fail to load post-fix, ensure `vite.config.js` `base: './'` remains set (it is) so asset URLs are relative in file:// context.
- Consider adding a startup check that logs an explicit error if `loadFile` throws to avoid silent `chromewebdata` fallbacks.
