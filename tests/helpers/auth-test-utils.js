import bcrypt from 'bcryptjs';
import { vi } from 'vitest';
import { db } from '../../src/db/database.js';
import { createId, hashValue } from '../../src/utils/crypto.js';

export async function resetTestDatabase() {
  vi.restoreAllMocks();

  db.data = {
    users: [],
    refreshTokens: [],
    emailVerificationTokens: [],
    revokedAccessTokens: [],
    loginAttempts: [],
  };

  vi.spyOn(db, 'write').mockResolvedValue(undefined);
}

export async function seedTestUser(overrides = {}) {
  const passwordHash = await bcrypt.hash(overrides.password ?? 'StrongPass123', 12);

  const user = {
    id: overrides.id ?? 'user-1',
    name: overrides.name ?? 'John Silva',
    email: overrides.email ?? 'john@email.com',
    passwordHash,
    emailVerified: overrides.emailVerified ?? true,
    emailVerifiedAt: overrides.emailVerifiedAt ?? '2026-04-17T00:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-04-17T00:00:00.000Z',
  };

  db.data.users.push(user);

  return user;
}

export function seedExpiredRefreshToken(userId, rawToken = 'expired-refresh-token') {
  const now = new Date().toISOString();

  db.data.refreshTokens.push({
    id: createId(),
    userId,
    familyId: createId(),
    tokenHash: hashValue(rawToken),
    createdAt: now,
    expiresAt: '2026-04-16T00:00:00.000Z',
    familyExpiresAt: now,
    revokedAt: null,
  });

  return rawToken;
}

export function seedFamilyExpiredRefreshToken(userId, rawToken = 'expired-family-refresh-token') {
  const now = new Date();

  db.data.refreshTokens.push({
    id: createId(),
    userId,
    familyId: createId(),
    tokenHash: hashValue(rawToken),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    familyExpiresAt: new Date(now.getTime() - 60 * 1000).toISOString(),
    revokedAt: null,
  });

  return rawToken;
}
