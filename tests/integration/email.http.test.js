import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  createTransport: createTransportMock,
}));

const EMAIL_ENV_KEYS = [
  'EMAIL_ENABLED',
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
];

let previousEnv = {};

function setBaseEmailEnv() {
  process.env.EMAIL_ENABLED = 'true';
  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.EMAIL_FROM = 'no-reply@example.com';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASSWORD = 'smtp-password';
}

async function loadApp(overrides = {}) {
  setBaseEmailEnv();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) {
      delete process.env[key];
      continue;
    }

    process.env[key] = String(value);
  }

  vi.resetModules();
  const { app } = await import('../../src/app.js');
  return app;
}

beforeEach(() => {
  previousEnv = Object.fromEntries(EMAIL_ENV_KEYS.map((key) => [key, process.env[key]]));
  createTransportMock.mockReset();
  sendMailMock.mockReset();
  createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  sendMailMock.mockResolvedValue({
    messageId: 'message-123',
    accepted: ['john@example.com'],
    rejected: [],
  });
});

afterEach(() => {
  for (const key of EMAIL_ENV_KEYS) {
    if (previousEnv[key] === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = previousEnv[key];
  }
});

describe('email http flow', () => {
  it('sends email using smtp provider', async () => {
    const app = await loadApp();

    const response = await request(app).post('/email/send').send({
      to: 'john@example.com',
      subject: 'Welcome',
      text: 'Hello from StackForge',
    });

    expect(response.status).toBe(202);
    expect(response.body.message).toBe('Email queued for delivery.');
    expect(response.body.delivery.messageId).toBe('message-123');
    expect(createTransportMock).toHaveBeenCalledOnce();
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@example.com',
        to: 'john@example.com',
        subject: 'Welcome',
      }),
    );

    const openApiResponse = await request(app).get('/openapi.json');
    expect(openApiResponse.status).toBe(200);
    expect(openApiResponse.body.paths['/email/send']).toBeDefined();
  });

  it('rejects when email provider is disabled', async () => {
    const app = await loadApp({ EMAIL_PROVIDER: 'none' });

    const response = await request(app).post('/email/send').send({
      to: 'john@example.com',
      subject: 'Welcome',
      text: 'Hello',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email provider is disabled. Set EMAIL_PROVIDER=smtp.');
  });

  it('does not expose route when email feature is disabled', async () => {
    const app = await loadApp({ EMAIL_ENABLED: 'false' });

    const response = await request(app).post('/email/send').send({
      to: 'john@example.com',
      subject: 'Welcome',
      text: 'Hello',
    });

    expect(response.status).toBe(404);

    const openApiResponse = await request(app).get('/openapi.json');
    expect(openApiResponse.status).toBe(200);
    expect(openApiResponse.body.paths['/email/send']).toBeUndefined();
  });
});
