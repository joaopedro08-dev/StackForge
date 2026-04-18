import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshTokenHandler,
  registerHandler,
} from './auth.controller.js';

const authRouter = Router();

authRouter.post('/register', registerHandler);
authRouter.post('/login', loginHandler);
authRouter.get('/me', authenticate, meHandler);
authRouter.post('/refresh-token', verifyCsrfToken, refreshTokenHandler);
authRouter.post('/logout', verifyCsrfToken, logoutHandler);

export { authRouter };
