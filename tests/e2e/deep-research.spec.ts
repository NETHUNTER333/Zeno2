import { test, expect } from '@playwright/test';
import { enterGuestMode } from './helpers';

test.describe('Deep Research Suite @external', () => {
  test('runs research query and renders report with at least 3 cited sources within 60s', async ({ page }) => {
    test.setTimeout(70_000);

    await page.goto('/research');
    await enterGuestMode(page);

    const chatInput = page.locator('textarea, input[placeholder*="Research"], input[placeholder*="Ask"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 15_000 });

    const query = 'best budget phones in India 2026';
    await chatInput.fill(query);
    await chatInput.press('Enter');

    // Wait for the research report to finish and render citations
    const citationElements = page.locator('a[href^="http"], [class*="source"], [class*="citation"], [class*="reference"]');
    await expect(async () => {
      const count = await citationElements.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 60_000 });

    const pageText = (await page.locator('body').textContent()) || '';
    expect(pageText.toLowerCase()).toContain('phone');
  });
});
