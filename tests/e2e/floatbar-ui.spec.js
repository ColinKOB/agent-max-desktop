import { test, expect } from '@playwright/test';

// These tests run against the web dev server (Vite) without Electron.
// window.electron calls are guarded with optional chaining in the app, so they will be no-ops here.

const APP = 'http://localhost:5173/';

test.describe('Apple FloatBar - Pill/Bar UX', () => {
  test('Pill is present, expands to bar, shrink returns to pill, no card', async ({ page }) => {
    await page.goto(APP);

    // Pill present
    const pill = page.locator('.amx-root.amx-mini');
    await expect(pill).toBeVisible();

    // Expand to bar by clicking pill
    await pill.click();

    const bar = page.locator('.apple-bar-container');
    await expect(bar).toBeVisible();

    // Ensure bar width is constrained (design cap 360px)
    const maxWidth = await bar.evaluate((el) => getComputedStyle(el).maxWidth);
    expect(maxWidth).toBe('360px');

    // Ensure card is not used
    await expect(page.locator('.amx-card')).toHaveCount(0);

    // Shrink back to pill
    const shrinkBtn = page.locator('.apple-toolbar .apple-tool-btn[title="Shrink"]');
    await expect(shrinkBtn).toBeVisible();
    await shrinkBtn.click();

    // Pill visible again
    await expect(page.locator('.amx-root.amx-mini')).toBeVisible();
  });
});
