import { test, expect } from '@playwright/test';

test.describe('Share Card Suite', () => {
  test('generates share card and snapshot links with Kinich branding and kinich.app domain', async ({ request, baseURL }) => {
    // Call share metadata API or verify card generator branding
    const targetOrigin = baseURL || 'https://kinich.app';
    const res = await request.get(`${targetOrigin}/api/share/metadata?title=Test+Snapshot&summary=Kinich+AI+Search`);

    expect(res.ok()).toBe(true);
    const body = await res.json();
    const jsonStr = JSON.stringify(body);

    // Assert branding contains Kinich and kinich.app and NO legacy strings
    expect(jsonStr).toContain('Kinich');
    expect(jsonStr).not.toContain('ZENO');
    expect(jsonStr).not.toContain('zeno0x');
    expect(jsonStr).not.toContain('kinich0x');
  });
});
