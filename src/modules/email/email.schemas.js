import { z } from 'zod';

export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(10000),
  html: z.string().max(30000).optional(),
});
