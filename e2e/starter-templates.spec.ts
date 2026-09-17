import { expect, test } from '@playwright/test';
import { freshApp } from './helpers';

test.describe('starter routines', () => {
  test('adding a starter routine creates a real, editable template that survives a reload', async ({
    page,
  }) => {
    await freshApp(page);

    await page.goto('/templates');
    await expect(page.getByText('No templates yet')).toBeVisible();
    await page.getByRole('button', { name: 'Browse preset routines' }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Full Body Strength' })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Push Day' })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Pull Day' })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Leg Day' })).toBeVisible();

    await sheet.getByRole('button', { name: 'Add to my templates' }).first().click();
    await expect(page.getByText('"Full Body Strength" added to your templates.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();

    // It's a real template: listed, startable, editable, and it survives a reload.
    await expect(page.getByRole('heading', { name: 'Full Body Strength', level: 2 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Full Body Strength', level: 2 })).toBeVisible();

    await page.getByRole('link', { name: /Full Body Strength/ }).click();
    await expect(page.getByRole('heading', { name: 'Edit template' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Back Squat', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plank', level: 2 })).toBeVisible();
  });
});
