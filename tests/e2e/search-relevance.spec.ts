import { test, expect } from '@playwright/test';

test.describe('Search Relevance Suite @external', () => {
  test('returns entity-matched live search results and distinct source lists across queries', async ({ request, baseURL }) => {
    // Call API directly or via page to verify live search endpoint relevance
    const apiRes = await request.post(`${baseURL || 'https://kinich.app'}/api/search`, {
      data: { query: 'latest news on AI regulation in India', mode: 'news' },
    });

    expect(apiRes.ok()).toBe(true);
    const body = await apiRes.json();
    const results = Array.isArray(body?.results) ? body.results : [];
    expect(results.length).toBeGreaterThan(0);

    // Assert at least one source title or snippet contains "India" AND ("AI" OR "regulation")
    const matchesEntity = results.some((r: any) => {
      const combined = `${r.title || ''} ${r.snippet || ''}`.toLowerCase();
      const hasIndia = combined.includes('india') || combined.includes('indian');
      const hasAiOrReg = combined.includes('ai') || combined.includes('regulation') || combined.includes('regulatory');
      return hasIndia && hasAiOrReg;
    });

    expect(matchesEntity).toBe(true);

    // Call a second query and assert different source lists are returned
    const apiRes2 = await request.post(`${baseURL || 'https://kinich.app'}/api/search`, {
      data: { query: 'quantum computing developments 2026', mode: 'news' },
    });

    expect(apiRes2.ok()).toBe(true);
    const body2 = await apiRes2.json();
    const results2 = Array.isArray(body2?.results) ? body2.results : [];

    const urls1 = results.map((r: any) => r.url).join(',');
    const urls2 = results2.map((r: any) => r.url).join(',');
    expect(urls1).not.toEqual(urls2);
  });
});
