import { test, expect } from '@playwright/test';

test('smoke: signed-in user sees the projects page', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByTestId('new-project-button')).toBeVisible();
});
