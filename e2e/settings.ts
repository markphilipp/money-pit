import { expect, type Page } from '@playwright/test';

export const settingsNav = (page: Page) => page.getByRole('navigation', { name: 'Settings' });

export async function openSettings(page: Page, section: string) {
  await page.getByLabel('Account menu').click();
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(page).toHaveURL(/\/settings\/rules$/);
  await settingsNav(page).getByRole('link', { name: section }).click();
}
