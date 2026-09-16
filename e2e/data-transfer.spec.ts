import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { freshApp } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'strong-export.csv');

test('import a Strong CSV, export a backup, clear the data and restore it', async ({ page }, testInfo) => {
  await freshApp(page);

  // --- import ---
  await page.goto('/settings/import');
  await page.getByLabel('Choose a Strong CSV export').setInputFiles(FIXTURE);
  await expect(page.getByRole('heading', { name: 'strong-export.csv' })).toBeVisible();
  await expect(page.getByText('2 workouts found', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Import 2 workouts/ }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
  await expect(page.getByText('2 workouts written')).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Push A', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pull A', level: 2 })).toBeVisible();

  // --- re-importing the same file is deduplicated by fingerprint ---
  await page.goto('/settings/import');
  await page.getByLabel('Choose a Strong CSV export').setInputFiles(FIXTURE);
  await expect(page.getByText('2 already imported')).toBeVisible();

  // --- export a backup ---
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Data' }).click();
  const download = await Promise.race([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON backup' }).click().then(() => page.waitForEvent('download')),
  ]);
  const backupPath = testInfo.outputPath('backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  expect(backup.format).toBe('repforge-backup');
  expect(backup.data.workouts).toHaveLength(2);

  // --- clear everything ---
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click();
  await page.goto('/history');
  await expect(page.getByText('No workouts yet')).toBeVisible();

  // --- restore ---
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Data' }).click();
  await page.getByLabel('Choose a RepForge JSON backup').setInputFiles(backupPath);
  await expect(page.getByRole('heading', { name: 'Restore preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Merge into my data' }).click();
  await expect(page.getByText(/2 workouts added/)).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Push A', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pull A', level: 2 })).toBeVisible();
});

test('an invalid backup is rejected without touching stored data', async ({ page }, testInfo) => {
  await freshApp(page);
  const badPath = testInfo.outputPath('not-a-backup.json');
  writeFileSync(badPath, JSON.stringify({ hello: 'world' }));

  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Data' }).click();
  await page.getByLabel('Choose a RepForge JSON backup').setInputFiles(badPath);
  await expect(page.getByText('This file is not a valid RepForge backup, so nothing was changed.')).toBeVisible();
});
