import { Page } from '@playwright/test';

/**
 * Enters guest mode by ticking the 18+ age checkbox and clicking "Continue as Guest"
 */
export async function enterGuestMode(page: Page) {
  try {
    const ageCheckbox = page.locator('[data-testid="guest-age-checkbox"], input[type="checkbox"]').first();
    if (await ageCheckbox.isVisible().catch(() => false)) {
      await ageCheckbox.check({ force: true });
      const guestBtn = page.locator('[data-testid="guest-continue-btn"], button:has-text("Continue as Guest")').first();
      if (await guestBtn.isVisible().catch(() => false)) {
        await guestBtn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }
  } catch {}
}
