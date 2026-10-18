import { expect, test } from '@playwright/test';

/**
 * The language switch is visitor-local (localStorage) and works without an
 * account, so the login screen is enough to verify translation and persistence.
 */
test.describe('interface language', () => {
  test('switches to Simplified Chinese and persists across reloads', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();

    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('menuitem', { name: '简体中文' }).click();

    await expect(page.getByRole('heading', { name: '登录以继续' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    await page.reload();
    await expect(page.getByRole('heading', { name: '登录以继续' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  });

  test('system default follows the browser language', async ({ page }) => {
    await page.goto('/login');
    // Playwright is pinned to en-US in playwright.config.ts.
    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a widget ?lang override does not change the stored preference', async ({ page }) => {
    await page.goto('/widget/not-a-real-token?lang=zh-CN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('ts6-ui');
      return raw ? JSON.parse(raw).state?.language ?? null : null;
    });
    expect(stored === null || stored === 'system').toBe(true);
  });
});
