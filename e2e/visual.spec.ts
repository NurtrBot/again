import { test, expect } from '@playwright/test';
import bounds from './panel-bounds.json';

/* Deterministic screenshots of the 21 review states at the 390px baseline.
 * Baselines are generated only after human review: `npx playwright test e2e/visual.spec.ts --update-snapshots`. */
for (const [id, b] of Object.entries(bounds as Record<string, { cssH: number; name: string }>)) {
  test(`review ${id} ${b.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: b.cssH });
    await page.goto(`/review/${id}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: false });
  });
}

test('review routes have no horizontal overflow at 360px', async ({ page }) => {
  for (const id of Object.keys(bounds)) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/review/${id}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `screen ${id} overflows horizontally`).toBe(false);
  }
});
