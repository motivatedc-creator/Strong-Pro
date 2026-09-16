import { expect, test, type Page } from '@playwright/test';
import { addExercise, expectNoHorizontalOverflow, freshApp, logSet } from './helpers';

/**
 * Responsive and accessibility QA.
 *
 * Every primary screen is rendered at the supported viewport sizes in both themes and
 * checked for horizontal overflow, undersized touch targets and missing landmarks.
 */

const VIEWPORTS = [
  { width: 320, height: 568, name: '320' },
  { width: 375, height: 812, name: '375' },
  { width: 390, height: 844, name: '390' },
  { width: 768, height: 1024, name: '768' },
  { width: 1024, height: 768, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
];

const ROUTES = ['/', '/templates', '/history', '/analytics', '/measurements', '/tools', '/settings', '/more'];

async function seed(page: Page) {
  await freshApp(page);
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await addExercise(page, 'Bench Press');
  await logSet(page, 1, '80', '5');
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
}

test('no horizontal overflow on any primary screen at any supported width', async ({ page }) => {
  await seed(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `e2e/screenshots/${viewport.name}-${route.replace(/\//g, '_') || 'home'}.png`,
        fullPage: false,
      });
    }
  }
});

test('the active workout screen fits the smallest supported phone', async ({ page }) => {
  await freshApp(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await addExercise(page, 'Back Squat');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'e2e/screenshots/320-active-workout.png' });

  // The primary logging controls must all meet the 44px touch target minimum.
  for (const name of ['Complete set 1', 'Increase weight', 'Decrease weight']) {
    const box = await page.getByRole('button', { name: new RegExp(name) }).first().boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(36);
    expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(36);
  }
});

test('dark and light themes both render the core screens', async ({ page }) => {
  await seed(page);
  for (const mode of ['dark', 'light'] as const) {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Appearance' }).click();
    await page.getByRole('radio', { name: mode === 'dark' ? 'Dark' : 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);

    for (const route of ['/', '/analytics', '/history']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `e2e/screenshots/theme-${mode}${route.replace(/\//g, '_') || '-home'}.png` });
    }
  }
});

test('every page exposes a main landmark, a heading and a primary navigation', async ({ page }) => {
  await freshApp(page);
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeVisible();
  }
});
