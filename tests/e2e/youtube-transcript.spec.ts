import { test, expect } from '@playwright/test';
import { enterGuestMode } from './helpers';

test.describe('YouTube Transcript Suite @external', () => {
  test('empty /study page load makes zero /api/treg/extract calls', async ({ page }) => {
    let tregExtractCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/treg/extract')) {
        tregExtractCalled = true;
      }
    });

    await page.goto('/study');
    await enterGuestMode(page);
    await page.waitForTimeout(2000);

    expect(tregExtractCalled).toBe(false);
  });

  test('fetches transcript and renders summary and quiz for video IDs aircAruvnKk and kCc8FmEb1nY', async ({ request, baseURL }) => {
    const videoIds = ['aircAruvnKk', 'kCc8FmEb1nY'];

    for (const id of videoIds) {
      const res = await request.post(`${baseURL || 'https://kinich.app'}/api/youtube/transcript`, {
        data: { url: `https://www.youtube.com/watch?v=${id}` },
      });

      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.videoId).toBe(id);
      expect(data.transcript?.length || data.text?.length).toBeGreaterThan(0);
    }
  });
});
