import { test, expect } from '@playwright/test';

test.describe('Health API Suite', () => {
  test('/api/health returns 200 and contains no secret/schema keys', async ({ request, baseURL }) => {
    const targetUrl = baseURL || 'https://kinich.app';
    const res = await request.get(`${targetUrl}/api/health`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');

    // Assert zero information disclosure keys in health response
    expect(body).not.toHaveProperty('projectId');
    expect(body).not.toHaveProperty('firebaseProjectId');
    expect(body).not.toHaveProperty('routes');
  });
});
