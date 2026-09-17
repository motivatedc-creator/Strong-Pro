import { expect, test } from '@playwright/test';
import { addExercise, freshApp, logSet } from './helpers';

test.describe('template to history', () => {
  test('create a template, run it, survive a reload, finish, and see it in history and analytics', async ({
    page,
  }) => {
    await freshApp(page);

    // --- build a template ---
    await page.getByRole('link', { name: 'Templates' }).first().click();
    await page.getByRole('link', { name: 'New template' }).first().click();
    await page.getByLabel('Template name').fill('Push A');
    await page.getByRole('button', { name: 'Add exercises' }).click();
    const picker = page.getByRole('dialog');
    await picker.getByLabel('Search exercises').fill('Bench Press');
    await picker.getByRole('button', { name: /^Bench Press/ }).first().click();
    await picker.getByRole('button', { name: /^Add selected/ }).click();
    await expect(page.getByRole('heading', { name: 'Bench Press', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByRole('heading', { name: 'Templates', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Push A', level: 2 })).toBeVisible();

    // --- start it ---
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
    // The template seeded three target sets.
    await expect(page.getByRole('button', { name: /Complete set 1/ })).toBeVisible();

    await logSet(page, 1, '60', '8');
    await logSet(page, 2, '80', '5');

    // --- survive a reload: the active workout and the logged sets must come back ---
    await page.reload();
    await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
    await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('60');
    await expect(page.getByRole('button', { name: 'Mark set 2 as not done' })).toBeVisible();

    await logSet(page, 3, '90', '3');

    // --- finish ---
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
    await expect(page.getByText('3', { exact: false }).first()).toBeVisible();
    // Every set is a first-time record, so the summary must say so.
    await expect(page.getByText(/new record/)).toBeVisible();

    // --- history ---
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: 'Push A', level: 2 })).toBeVisible();
    await expect(page.getByText('3 sets')).toBeVisible();

    // --- analytics use the real data ---
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Estimated 1RM — Bench Press' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Show data table' }).first().click();
    await expect(page.getByRole('table').first()).toBeVisible();
  });

  test('an empty workout survives navigation away and back', async ({ page }) => {
    await freshApp(page);
    await page.getByRole('button', { name: 'Start empty workout' }).click();
    await addExercise(page, 'Back Squat');
    await logSet(page, 1, '100', '5');

    await page.goto('/history');
    await expect(page.getByRole('link', { name: /Workout in progress/ })).toBeVisible();
    await page.getByRole('link', { name: /Workout in progress/ }).click();
    await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('100');

    // discarding removes it entirely
    await page.getByRole('button', { name: 'Discard workout' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start empty workout' })).toBeVisible();
  });

  test('deleting a set can be undone', async ({ page }) => {
    await freshApp(page);
    await page.getByRole('button', { name: 'Start empty workout' }).click();
    await addExercise(page, 'Conventional Deadlift');
    await logSet(page, 1, '140', '5');

    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByText('Set deleted.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByLabel('Weight for set 1 in kg')).toHaveValue('140');
  });
});

test.describe('rest timer', () => {
  test('starts on set completion and resumes after a reload', async ({ page }) => {
    await freshApp(page);
    await page.getByRole('button', { name: 'Start empty workout' }).click();
    await addExercise(page, 'Overhead Press');
    await logSet(page, 1, '40', '8');

    await expect(page.getByText('Resting')).toBeVisible();
    await page.reload();
    // Reconstructed from the stored end timestamp, not from an in-memory counter.
    await expect(page.getByText('Resting')).toBeVisible();

    await page.getByRole('button', { name: 'Add 15 seconds' }).click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Resting')).toBeHidden();
  });
});
