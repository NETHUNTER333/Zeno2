import { test, expect } from '@playwright/test';

test.describe('SEO Suite', () => {
  test('HTML metadata contains correct canonical and og:url pointing to kinich.app', async ({ request, baseURL }) => {
    const targetUrl = baseURL || 'https://kinich.app';
    const res = await request.get(targetUrl);
    expect(res.ok()).toBe(true);

    const html = await res.text();

    // Check canonical link
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                           html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    expect(canonicalMatch).toBeTruthy();
    expect(canonicalMatch![1]).toMatch(/^https:\/\/kinich\.app\/?$/);

    // Check og:url
    const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
    expect(ogUrlMatch).toBeTruthy();
    expect(ogUrlMatch![1]).toMatch(/^https:\/\/kinich\.app\/?$/);

    // Assert zero references to non-owned domain kinich.ai
    expect(html).not.toContain('kinich.ai');
  });

  test('sitemap.xml contains only kinich.app URLs', async ({ request, baseURL }) => {
    const targetUrl = baseURL || 'https://kinich.app';
    const res = await request.get(`${targetUrl}/sitemap.xml`);
    expect(res.ok()).toBe(true);

    const xml = await res.text();
    const locs = Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)).map((m) => m[1].trim());

    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).toContain('https://kinich.app');
      expect(loc).not.toContain('kinich.ai');
      expect(loc).not.toContain('kinich0x');
    }
  });
});
