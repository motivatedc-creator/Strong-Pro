import { expect, test } from '@playwright/test';
import { addExercise, freshApp, logSet } from './helpers';

/**
 * PWA / offline QA against the production build served by `vite preview`.
 */
test('the app shell and core features work offline once the service worker is ready', async ({
  page,
  context,
}) => {
  await freshApp(page);

  // Warm the caches by visiting the routes we will exercise offline.
  for (const route of ['/', '/templates', '/history', '/tools/plates']) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker?.ready;
  });

  await context.setOffline(true);
  // A cold navigation with no network at all must still serve the app shell.
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();

  // Logging works with no network at all.
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await addExercise(page, 'Back Squat');
  await logSet(page, 1, '120', '3');
  await page.reload();
  await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('120');

  // So does the plate calculator.
  await page.goto('/tools/plates');
  await page.getByLabel('Target weight (kg)').fill('100');
  await expect(page.getByText('Exact match.')).toBeVisible();

  await context.setOffline(false);
});

test('the web manifest describes an installable app', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(href).toBeTruthy();
  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toContain('RepForge');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe('#0b0f14');
  expect(manifest.icons.length).toBeGreaterThan(0);
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
});
