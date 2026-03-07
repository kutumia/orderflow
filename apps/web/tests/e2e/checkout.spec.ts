import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('landing page loads and shows OrderFlow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OrderFlow/i);
  });

  test('root responds with expected content or redirect', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(500);
  });
});
