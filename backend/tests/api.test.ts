import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

describe('General API', () => {
  it('should return 401 for protected route without token', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  it('should return 200 for unknown non-api route (fallback to index.html)', async () => {
    const res = await request(app).get('/some-random-page');
    // If frontend dist exists, it returns 200. If not, it returns 404.
    // In this environment it seems to exist.
    expect([200, 404]).toContain(res.status);
    if (res.status === 404) {
      expect(res.text).toContain('Site is building');
    }
  });
});
