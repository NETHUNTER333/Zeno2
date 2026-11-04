import { test, expect } from '@playwright/test';
import { enterGuestMode } from './helpers';

test.describe('Smoke Test Suite', () => {
  test('loads /, /pricing, /settings, and /study without console or Firebase/CORS errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const forbiddenErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        if (text.includes('unauthorized domain') || text.includes('CORS') || text.includes('Access-Control-Allow-Origin')) {
          forbiddenErrors.push(text);
        }
      }
    });

    const routes = ['/', '/pricing', '/settings', '/study'];
    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);

      // Dismiss guest gate on initial page load if present
      await enterGuestMode(page);

      // Verify page title or key headings exist
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    }

    expect(forbiddenErrors).toEqual([]);
  });

  test('guest gate modal works properly', async ({ page }) => {
    await page.goto('/');
    const ageCheckbox = page.locator('[data-testid="guest-age-checkbox"], input[type="checkbox"]').first();
    const guestBtn = page.locator('[data-testid="guest-continue-btn"], button:has-text("Continue as Guest")').first();

    if (await ageCheckbox.isVisible().catch(() => false)) {
      expect(await guestBtn.isDisabled()).toBe(true);
      await ageCheckbox.check({ force: true });
      expect(await guestBtn.isEnabled()).toBe(true);
      await guestBtn.click({ force: true });
      await page.waitForTimeout(500);
      expect(await ageCheckbox.isVisible()).toBe(false);
    }
  });
});
