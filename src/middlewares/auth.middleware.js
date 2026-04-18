import { HttpError } from '../utils/http-error.js';
import { validateAccessToken } from '../modules/auth/auth.service.js';

export function authenticate(req, _res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Access token is required.');
    }

    const token = authorizationHeader.replace('Bearer ', '').trim();
    req.auth = validateAccessToken(token);

    next();
  } catch (error) {
    next(error);
  }
}
