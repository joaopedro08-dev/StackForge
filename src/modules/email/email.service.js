import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';

function assertSmtpConfigured() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new HttpError(
      500,
      'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD to send emails.',
    );
  }
}

async function getNodemailerModule() {
  try {
    return await import('nodemailer');
  } catch {
    throw new HttpError(500, 'Email dependency is missing. Install nodemailer to enable SMTP delivery.');
  }
}

export async function sendEmail(payload) {
  if (env.EMAIL_PROVIDER !== 'smtp') {
    throw new HttpError(400, 'Email provider is disabled. Set EMAIL_PROVIDER=smtp.');
  }

  assertSmtpConfigured();

  const nodemailerModule = await getNodemailerModule();
  const createTransport = nodemailerModule.createTransport || nodemailerModule.default?.createTransport;

  if (typeof createTransport !== 'function') {
    throw new HttpError(500, 'Unable to initialize email transport.');
  }

  const transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}
