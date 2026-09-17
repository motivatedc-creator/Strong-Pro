import { expect, test } from '@playwright/test';
import { addExercise, freshApp, logSet } from './helpers';

test.describe('tools', () => {
  test('plate calculator solves a target and applies it to a set', async ({ page }) => {
    await freshApp(page);

    // standalone
    await page.goto('/tools/plates');
    await page.getByLabel('Total weight on the bar (kg)').fill('100');
    await expect(page.getByText('Exact match.')).toBeVisible();
    await expect(page.getByText(/Per side: .*Total 100 kg\./)).toBeVisible();

    // an unreachable target reports the closest lower load
    // 101 kg is reachable with the seeded 0.5 kg plates, so use a target that is not.
    await page.getByLabel('Total weight on the bar (kg)').fill('100.2');
    await expect(
      page.getByText('Closest achievable load below the target with this inventory.'),
    ).toBeVisible();

    // inside a workout, the result can be written straight into the set
    await page.goto('/');
    await page.getByRole('button', { name: 'Start empty workout' }).click();
    await addExercise(page, 'Back Squat');
    await page.getByRole('button', { name: 'Plates', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Total weight on the bar (kg)').fill('140');
    await dialog.getByRole('button', { name: 'Put this weight in the set' }).click();
    await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('140');
  });

  test('warm-up generator inserts an editable ramp before the working sets', async ({ page }) => {
    await freshApp(page);
    await page.getByRole('button', { name: 'Start empty workout' }).click();
    await addExercise(page, 'Bench Press');
    await page.getByLabel('Weight for set 1 in kg').fill('100');
    await page.getByLabel('Weight for set 1 in kg').blur();

    await page.getByRole('button', { name: 'Warm-up', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Warm-up 1 weight')).toHaveValue('20');
    await dialog.getByRole('button', { name: 'Insert before working sets' }).click();

    await expect(page.getByText(/warm-up sets added/)).toBeVisible();
    // The bar set is now set 1 and the working set moved down.
    await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('20');
    const rows = page.getByRole('listitem').filter({ has: page.getByLabel(/^Weight for set/) });
    expect(await rows.count()).toBeGreaterThan(3);
  });
});

test.describe('measurements', () => {
  test('log measurements and inspect the trend', async ({ page }) => {
    await freshApp(page);
    await page.goto('/measurements');

    await page.getByRole('button', { name: 'Log' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Value (kg)').fill('82.5');
    await dialog.getByLabel('Date').fill('2026-09-01');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Log' }).first().click();
    await dialog.getByLabel('Value (kg)').fill('84');
    await dialog.getByLabel('Date').fill('2026-09-15');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('84 kg', { exact: false }).first()).toBeVisible();

    await page.goto('/measurements/bodyweight');
    await expect(page.getByRole('heading', { name: 'Body weight', level: 1 })).toBeVisible();
    await expect(page.getByText('+1.5').first()).toBeVisible();
    await page.getByRole('button', { name: 'Show data table' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('units and themes', () => {
  test('switching units keeps stored history numerically consistent', async ({ page }) => {
    await freshApp(page);
    await page.getByRole('button', { name: 'Start empty workout' }).click();
    await addExercise(page, 'Back Squat');
    await logSet(page, 1, '100', '5');
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
    await expect(page.getByText('100 kg × 5').first()).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Pounds' }).click();
    await page.goto('/history');
    await page
      .getByRole('link', { name: /Back Squat|workout/i })
      .first()
      .click();
    // 100 kg is 220.46 lb: the stored grams never changed, only the display.
    await expect(page.getByLabel('Weight for set 1 in lb')).toHaveValue('220.46');

    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Kilograms' }).click();
    await page.goto('/history');
    await page
      .getByRole('link', { name: /Back Squat|workout/i })
      .first()
      .click();
    await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('100');
  });

  test('theme choice persists across a reload', async ({ page }) => {
    await freshApp(page);
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Appearance' }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page
      .getByRole('button', { name: /Ledger/ })
      .first()
      .click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'glacier');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'glacier');
  });
});
