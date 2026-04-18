import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { resetTestDatabase, seedTestUser } from '../helpers/auth-test-utils.js';

describe('authentication http flow', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('returns readiness status with database check', async () => {
    const response = await request(app).get('/health/readiness');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database.ok).toBe(true);
  });

  it('serves OpenAPI specification', async () => {
    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.paths['/auth/login']).toBeDefined();
    expect(response.body.paths['/auth/refresh-token']).toBeDefined();
  });

  it('serves Swagger UI documentation', async () => {
    const response = await request(app).get('/docs');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('/docs/');
  });

  it('returns x-request-id in responses', async () => {
    const response = await request(app).get('/health/liveness');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('preserves incoming x-request-id when provided by client', async () => {
    const response = await request(app)
      .get('/health/liveness')
      .set('x-request-id', 'custom-request-id-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('custom-request-id-123');
  });

  it('allows CORS for origins in allowlist', async () => {
    const response = await request(app)
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not set CORS allow-origin for origins outside allowlist', async () => {
    const response = await request(app)
      .options('/auth/login')
      .set('Origin', 'http://evil.local')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('registers, authenticates, reads session, refreshes and logs out', async () => {
    const agent = request.agent(app);
    const registerResponse = await agent.post('/auth/register').send({
      name: 'John Silva',
      email: 'john@email.com',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('john@email.com');
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));
    expect(registerResponse.headers['set-cookie']).toEqual(expect.any(Array));

    const meWithoutTokenResponse = await agent.get('/auth/me');
    expect(meWithoutTokenResponse.status).toBe(401);

    const loginResponse = await agent.post('/auth/login').send({
      email: 'john@email.com',
      password: 'StrongPass123',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.csrfToken).toEqual(expect.any(String));

    const csrfToken = loginResponse.body.csrfToken;

    const meResponse = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe('john@email.com');

    const refreshResponse = await agent
      .post('/auth/refresh-token')
      .set('x-csrf-token', csrfToken);
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.accessToken.length).toBeGreaterThan(0);
    expect(refreshResponse.body.csrfToken).toEqual(expect.any(String));

    const logoutResponse = await agent
      .post('/auth/logout')
      .set('x-csrf-token', refreshResponse.body.csrfToken);
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe('Logged out successfully.');
  });

  it('rejects logout without refresh token cookie', async () => {
    const response = await request(app)
      .post('/auth/logout')
      .set('Cookie', ['csrfToken=test-csrf-token'])
      .set('x-csrf-token', 'test-csrf-token');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unable to end the session. Please log in again.');
  });

  it('rejects refresh when csrf token is missing', async () => {
    const agent = request.agent(app);

    await agent.post('/auth/register').send({
      name: 'John Silva',
      email: 'csrf@email.com',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
    });

    const response = await agent.post('/auth/refresh-token');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('CSRF token invalid or missing.');
  });

  it('rejects register when password confirmation does not match', async () => {
    const response = await request(app).post('/auth/register').send({
      name: 'John Silva',
      email: 'john@email.com',
      password: 'StrongPass123',
      confirmPassword: 'DifferentPass123',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed.');
  });

  it('rejects login with invalid credentials', async () => {
    await seedTestUser();

    const response = await request(app).post('/auth/login').send({
      email: 'john@email.com',
      password: 'WrongPass123',
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('blocks login after repeated failed attempts', async () => {
    await seedTestUser({ email: 'blocked@email.com' });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post('/auth/login').send({
        email: 'blocked@email.com',
        password: 'WrongPassword123',
      });

      expect(response.status).toBe(401);
    }

    const blockedResponse = await request(app).post('/auth/login').send({
      email: 'blocked@email.com',
      password: 'StrongPass123',
    });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.message).toBe('Too many failed login attempts. Try again later.');
  }, 10000);
});
