import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { query } from '../src/db.js';

describe('Auth API', () => {
  const testEmail = `test-${Math.random()}@example.com`;
  const testPassword = 'password123';

  it('should sign up a new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: testEmail,
        password: testPassword,
        businessName: 'Test Business',
        category: 'Barbershop'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should not sign up a user with an existing email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Another User',
        email: testEmail,
        password: testPassword,
        businessName: 'Another Business',
        category: 'Salon'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email is already registered');
  });

  it('should log in the user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should not log in with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
  });
});
