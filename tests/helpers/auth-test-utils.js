import bcrypt from 'bcryptjs';
import { vi } from 'vitest';
import { db } from '../../src/db/database.js';
import { createId, hashValue } from '../../src/utils/crypto.js';

export async function resetTestDatabase() {
  vi.restoreAllMocks();

  db.data = {
    users: [],
    refreshTokens: [],
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
    createdAt: overrides.createdAt ?? '2026-04-17T00:00:00.000Z',
  };

  db.data.users.push(user);

  return user;
}

export function seedExpiredRefreshToken(userId, rawToken = 'expired-refresh-token') {
  db.data.refreshTokens.push({
    id: createId(),
    userId,
    familyId: createId(),
    tokenHash: hashValue(rawToken),
    createdAt: '2026-04-17T00:00:00.000Z',
    expiresAt: '2026-04-16T00:00:00.000Z',
    revokedAt: null,
  });

  return rawToken;
}
