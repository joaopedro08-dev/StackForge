import { HttpError } from '../../utils/http-error.js';
import { sendEmailSchema } from './email.schemas.js';
import { sendEmail } from './email.service.js';

export async function sendEmailHandler(req, res, next) {
  try {
    const payload = sendEmailSchema.parse(req.body);
    const result = await sendEmail(payload);

    return res.status(202).json({
      message: 'Email queued for delivery.',
      delivery: result,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }

    next(error);
  }
}
