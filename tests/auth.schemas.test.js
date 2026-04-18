import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src/modules/auth/auth.schemas.js';

describe('auth schemas', () => {
  it('accepts a valid register payload', () => {
    const result = registerSchema.safeParse({
      name: 'John Silva',
      email: 'john@email.com',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects register payload when passwords do not match', () => {
    const result = registerSchema.safeParse({
      name: 'John Silva',
      email: 'john@email.com',
      password: 'StrongPass123',
      confirmPassword: 'DifferentPass123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('accepts a valid login payload', () => {
    const result = loginSchema.safeParse({
      email: 'john@email.com',
      password: 'StrongPass123',
    });

    expect(result.success).toBe(true);
  });
});
