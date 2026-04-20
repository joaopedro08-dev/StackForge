import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  createTransport: createTransportMock,
}));

const EMAIL_VERIFICATION_ENV_KEYS = [
  'EMAIL_ENABLED',
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES',
];

let previousEnv = {};

function setEmailVerificationEnv() {
  process.env.EMAIL_ENABLED = 'true';
  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.EMAIL_FROM = 'no-reply@example.com';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASSWORD = 'smtp-password';
  process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES = '60';
}

async function loadAppWithFreshDb() {
  vi.resetModules();
  setEmailVerificationEnv();

  const { db } = await import('../../src/db/database.js');
  db.data = {
    users: [],
    refreshTokens: [],
    emailVerificationTokens: [],
    revokedAccessTokens: [],
    loginAttempts: [],
  };
  vi.spyOn(db, 'write').mockResolvedValue(undefined);

  const { createApp } = await import('../../src/app.js');

  return createApp();
}

function extractVerificationTokenFromMailCall() {
  const firstMail = sendMailMock.mock.calls[0]?.[0];
  const text = firstMail?.text ?? '';
  const tokenMatch = text.match(/verification token is:\s*([^\s]+)/i);

  return tokenMatch?.[1] ?? null;
}

beforeEach(() => {
  previousEnv = Object.fromEntries(EMAIL_VERIFICATION_ENV_KEYS.map((key) => [key, process.env[key]]));
  createTransportMock.mockReset();
  sendMailMock.mockReset();
  createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  sendMailMock.mockResolvedValue({
    messageId: 'verification-message-123',
    accepted: ['verify@email.com'],
    rejected: [],
  });
});

afterEach(() => {
  for (const key of EMAIL_VERIFICATION_ENV_KEYS) {
    if (previousEnv[key] === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = previousEnv[key];
  }
});

describe('auth email verification flow', () => {
  it('requires email verification before login and accepts login after token verification', async () => {
    const app = await loadAppWithFreshDb();

    const registerResponse = await request(app).post('/auth/register').send({
      name: 'Verify Me',
      email: 'verify@email.com',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
    });

    expect(registerResponse.status).toBe(201);
    expect(createTransportMock).toHaveBeenCalledOnce();
    expect(sendMailMock).toHaveBeenCalledOnce();

    const blockedLoginResponse = await request(app).post('/auth/login').send({
      email: 'verify@email.com',
      password: 'StrongPass123',
    });

    expect(blockedLoginResponse.status).toBe(403);
    expect(blockedLoginResponse.body.message).toBe('Email not verified. Please verify your email address.');

    const verificationToken = extractVerificationTokenFromMailCall();
    expect(verificationToken).toEqual(expect.any(String));

    const verifyResponse = await request(app).get('/auth/verify-email').query({ token: verificationToken });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.message).toBe('Email verified successfully.');
    expect(verifyResponse.body.user.email).toBe('verify@email.com');

    const loginResponse = await request(app).post('/auth/login').send({
      email: 'verify@email.com',
      password: 'StrongPass123',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
  }, 20_000);

  it('rejects invalid verification token', async () => {
    const app = await loadAppWithFreshDb();

    const response = await request(app).get('/auth/verify-email').query({ token: 'invalid-token-value' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid or expired verification token.');
  });
});
