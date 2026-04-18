import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { CSRF_COOKIE_NAME } from '../../middlewares/csrf.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import { info, warn } from '../../utils/logger.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from './login-attempts.js';
import { getUserById, login, logout, refreshSession, register } from './auth.service.js';

const refreshCookieName = 'refreshToken';

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(refreshCookieName, getRefreshCookieOptions());
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    maxAge: env.CSRF_TOKEN_TTL_MINUTES * 60 * 1000,
    path: '/',
  };
}

function setCsrfCookie(res, csrfToken) {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, getCsrfCookieOptions());
}

export async function registerHandler(req, res, next) {
  try {
    const parsedBody = registerSchema.parse(req.body);
    const result = await register(parsedBody);
    const csrfToken = createCsrfToken();

    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, csrfToken);

    info('auth_register_success', {
      requestId: req.context?.requestId,
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip,
    });

    return res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      csrfToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(req, res, next) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;

  try {
    if (await isLoginBlocked(req.ip, email)) {
      warn('auth_login_blocked', {
        requestId: req.context?.requestId,
        email,
        ip: req.ip,
      });

      throw new HttpError(429, 'Too many failed login attempts. Try again later.');
    }

    const parsedBody = loginSchema.parse(req.body);
    const result = await login(parsedBody);
    const csrfToken = createCsrfToken();

    await clearLoginFailures(req.ip, parsedBody.email);

    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, csrfToken);

    info('auth_login_success', {
      requestId: req.context?.requestId,
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip,
    });

    return res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      csrfToken,
    });
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 401) {
      await recordLoginFailure(req.ip, email);

      warn('auth_login_failed', {
        requestId: req.context?.requestId,
        email,
        ip: req.ip,
      });
    }

    next(error);
  }
}

export async function meHandler(req, res, next) {
  try {
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    const user = await getUserById(req.auth.userId);

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function refreshTokenHandler(req, res, next) {
  try {
    const refreshTokenValue = req.cookies?.[refreshCookieName];
    const result = await refreshSession(refreshTokenValue);
    const csrfToken = createCsrfToken();

    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, csrfToken);

    info('auth_refresh_success', {
      requestId: req.context?.requestId,
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip,
    });

    return res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      csrfToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(req, res, next) {
  try {
    const refreshTokenValue = req.cookies?.[refreshCookieName];

    await logout(refreshTokenValue);
    clearRefreshCookie(res);
    clearCsrfCookie(res);

    info('auth_logout_success', {
      requestId: req.context?.requestId,
      ip: req.ip,
    });

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
}
