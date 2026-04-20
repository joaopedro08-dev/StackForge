import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { CSRF_COOKIE_NAME } from '../../middlewares/csrf.middleware.js';

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

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    maxAge: env.CSRF_TOKEN_TTL_MINUTES * 60 * 1000,
    path: '/',
  };
}

export function createCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions());
}

export function clearRefreshCookie(res) {
  res.clearCookie(refreshCookieName, getRefreshCookieOptions());
}

export function readRefreshCookie(req) {
  return req.cookies?.[refreshCookieName];
}

export function setCsrfCookie(res, csrfToken) {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());
}

export function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, getCsrfCookieOptions());
}
