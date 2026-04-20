import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password confirmation does not match.',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16),
});
