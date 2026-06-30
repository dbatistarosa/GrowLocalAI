import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

describe('Security', () => {
  it('should block basic SQL injection in login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "' OR '1'='1",
        password: "any"
      });

    // Should return 401 because that email doesn't exist (escaped)
    expect(res.status).toBe(401);
  });

  it('should block SQL injection in signup', async () => {
    const randomEmail = `inject-${Math.random()}' OR '1'='1@example.com`;
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: "Test",
        email: randomEmail,
        password: "any",
        businessName: "Test",
        category: "Test"
      });

    // If it's not escaped correctly, it might cause a DB error or skip existing check.
    // If escaped, it should just be a valid (weird) email.
    expect(res.status).toBe(201);
  });
});
