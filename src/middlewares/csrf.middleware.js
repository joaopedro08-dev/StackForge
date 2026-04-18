import { HttpError } from '../utils/http-error.js';

export const CSRF_COOKIE_NAME = 'csrfToken';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function verifyCsrfToken(req, _res, next) {
  try {
    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
    const csrfHeader = req.get(CSRF_HEADER_NAME);

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new HttpError(403, 'CSRF token invalid or missing.');
    }

    next();
  } catch (error) {
    next(error);
  }
}
