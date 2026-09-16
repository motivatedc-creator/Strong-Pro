import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E helpers.
 *
 * Every spec starts from a clean IndexedDB so runs are independent, and skips onboarding
 * by pre-seeding the settings row's completion timestamp through the app itself.
 */

export async function freshApp(page: Page): Promise<void> {
  // Playwright gives every test a fresh browser context, so IndexedDB and localStorage
  // start empty — there is nothing to clear, and clearing would race the app's own boot.
  await page.goto('/');
  await completeOnboarding(page);
}

export async function completeOnboarding(page: Page): Promise<void> {
  // Wait for the database gate to finish booting: until it does, neither the onboarding
  // screen nor Today exists yet and a visibility probe would race the spinner.
  const setup = page.getByRole('button', { name: 'Set up preferences' });
  const today = page.getByRole('heading', { name: 'Today', level: 1 });
  await expect(setup.or(today).first()).toBeVisible({ timeout: 20_000 });

  if (await setup.isVisible()) {
    await setup.click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Start training' }).click();
  }
  await expect(today).toBeVisible();
}

/** Fills the weight and reps of a set row and ticks it off. */
export async function logSet(
  page: Page,
  index: number,
  weight: string,
  reps: string,
): Promise<void> {
  await page.getByLabel(`Weight for set ${index} in kg`).fill(weight);
  await page.getByLabel(`Reps for set ${index}`).fill(reps);
  await page.getByLabel(`Reps for set ${index}`).blur();
  await page.getByRole('button', { name: `Complete set ${index}` }).click();
  await expect(page.getByRole('button', { name: `Mark set ${index} as not done` })).toBeVisible();
}

export async function addExercise(page: Page, name: string): Promise<void> {
  await page
    .getByRole('button', { name: /Add exercise/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Search exercises').fill(name);
  await dialog
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}`) })
    .first()
    .click();
  await dialog.getByRole('button', { name: /^Add selected/ }).click();
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Fails the test if the page scrolls horizontally at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `horizontal overflow: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}
