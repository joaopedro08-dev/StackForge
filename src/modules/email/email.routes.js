import { Router } from 'express';
import { sendEmailHandler } from './email.controller.js';

const emailRouter = Router();

emailRouter.post('/send', sendEmailHandler);

export { emailRouter };
