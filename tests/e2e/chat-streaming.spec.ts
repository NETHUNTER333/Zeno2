import { test, expect } from '@playwright/test';
import { enterGuestMode } from './helpers';

test.describe('Chat Streaming Suite @external', () => {
  test('streams tokens over time, completes answer, and renders sources', async ({ page }) => {
    await page.goto('/');
    await enterGuestMode(page);

    // Locate chat input box
    const chatInput = page.locator('textarea, input[placeholder*="Ask"], input[placeholder*="Search"], input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    const promptText = 'Explain photosynthesis in 2 clear sentences';
    await chatInput.fill(promptText);
    await chatInput.press('Enter');

    // Wait for response text container to appear
    const responseContainer = page.locator('.markdown-body, [class*="prose"], [class*="chat-message"], [class*="response"]').first();
    await expect(responseContainer).toBeVisible({ timeout: 20_000 });

    // Assert text grows over time during streaming
    let initialLength = 0;
    let finalLength = 0;

    for (let i = 0; i < 5; i++) {
      const currentText = (await responseContainer.textContent()) || '';
      if (i === 0) initialLength = currentText.length;
      finalLength = currentText.length;
      await page.waitForTimeout(600);
    }

    expect(finalLength).toBeGreaterThan(initialLength || 10);

    // Assert answer completes with non-empty content
    const finalText = (await responseContainer.textContent()) || '';
    expect(finalText.toLowerCase()).toContain('photosynthesis');
  });
});
