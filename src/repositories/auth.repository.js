import { db } from '../db/database.js';
import { env } from '../config/env.js';
import { getPrismaClient } from '../db/prisma-client.js';

function clone(value) {
  return structuredClone(value);
}

function isRelationalProvider() {
  return ['postgresql', 'mysql', 'sqlite', 'sqlserver'].includes(env.DATABASE_PROVIDER);
}

function isJsonProvider() {
  return env.DATABASE_PROVIDER === 'json';
}

function ensureSupportedProvider() {
  if (isRelationalProvider() || isJsonProvider()) {
    return;
  }

  throw new Error(
    `Database provider "${env.DATABASE_PROVIDER}" is not implemented yet. Use "json", "postgresql", "mysql", "sqlite" or "sqlserver".`,
  );
}

function mapUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt.toISOString(),
  };
}

function mapRefreshToken(refreshToken) {
  if (!refreshToken) {
    return null;
  }

  return {
    id: refreshToken.id,
    userId: refreshToken.userId,
    familyId: refreshToken.familyId,
    tokenHash: refreshToken.tokenHash,
    createdAt: refreshToken.createdAt.toISOString(),
    expiresAt: refreshToken.expiresAt.toISOString(),
    revokedAt: refreshToken.revokedAt ? refreshToken.revokedAt.toISOString() : null,
  };
}

function mapLoginAttempt(loginAttempt) {
  if (!loginAttempt) {
    return null;
  }

  return {
    id: loginAttempt.id,
    ipAddress: loginAttempt.ipAddress,
    email: loginAttempt.email,
    failCount: loginAttempt.failCount,
    lockLevel: loginAttempt.lockLevel,
    windowStart: loginAttempt.windowStart.toISOString(),
    blockedUntil: loginAttempt.blockedUntil ? loginAttempt.blockedUntil.toISOString() : null,
    lastFailedAt: loginAttempt.lastFailedAt.toISOString(),
  };
}

export async function findUserByEmail(email) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return mapUser(user);
  }

  return db.data.users.find((user) => user.email === email) ?? null;
}

export async function findUserById(userId) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    return mapUser(user);
  }

  return db.data.users.find((user) => user.id === userId) ?? null;
}

export async function createUser(user) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        createdAt: new Date(user.createdAt),
      },
    });

    return;
  }

  db.data.users.push(clone(user));
}

export async function createRefreshToken(refreshToken) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    await prisma.refreshToken.create({
      data: {
        id: refreshToken.id,
        userId: refreshToken.userId,
        familyId: refreshToken.familyId,
        tokenHash: refreshToken.tokenHash,
        createdAt: new Date(refreshToken.createdAt),
        expiresAt: new Date(refreshToken.expiresAt),
        revokedAt: refreshToken.revokedAt ? new Date(refreshToken.revokedAt) : null,
      },
    });

    return;
  }

  db.data.refreshTokens.push(clone(refreshToken));
}

export async function findActiveRefreshTokenByHash(tokenHash) {
  ensureSupportedProvider();

  const now = new Date();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const refreshToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    });

    return mapRefreshToken(refreshToken);
  }

  return (
    db.data.refreshTokens.find(
      (entry) =>
        entry.tokenHash === tokenHash &&
        entry.revokedAt === null &&
        new Date(entry.expiresAt).getTime() > now.getTime(),
    ) ?? null
  );
}

export async function revokeRefreshToken(tokenHash, revokedAt) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
    });

    if (!tokenRecord) {
      return null;
    }

    const updated = await prisma.refreshToken.update({
      where: {
        tokenHash,
      },
      data: {
        revokedAt: new Date(revokedAt),
      },
    });

    return mapRefreshToken(updated);
  }

  const tokenRecord = db.data.refreshTokens.find((entry) => entry.tokenHash === tokenHash);

  if (!tokenRecord) {
    return null;
  }

  tokenRecord.revokedAt = revokedAt;
  return tokenRecord;
}

export async function findRefreshTokenByHash(tokenHash) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const refreshToken = await prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
    });

    return mapRefreshToken(refreshToken);
  }

  return db.data.refreshTokens.find((entry) => entry.tokenHash === tokenHash) ?? null;
}

export async function revokeRefreshTokenFamily(familyId, revokedAt) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    await prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(revokedAt),
      },
    });

    return;
  }

  for (const refreshToken of db.data.refreshTokens) {
    if (refreshToken.familyId === familyId && refreshToken.revokedAt === null) {
      refreshToken.revokedAt = revokedAt;
    }
  }
}

export async function writeDatabase() {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    return;
  }

  return db.write();
}

export async function findLoginAttempt(ipAddress, email) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const attempt = await prisma.loginAttempt.findUnique({
      where: {
        ipAddress_email: {
          ipAddress,
          email,
        },
      },
    });

    return mapLoginAttempt(attempt);
  }

  return (
    db.data.loginAttempts.find((entry) => entry.ipAddress === ipAddress && entry.email === email) ?? null
  );
}

export async function upsertLoginAttempt(loginAttempt) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    const attempt = await prisma.loginAttempt.upsert({
      where: {
        ipAddress_email: {
          ipAddress: loginAttempt.ipAddress,
          email: loginAttempt.email,
        },
      },
      update: {
        failCount: loginAttempt.failCount,
        lockLevel: loginAttempt.lockLevel,
        windowStart: new Date(loginAttempt.windowStart),
        blockedUntil: loginAttempt.blockedUntil ? new Date(loginAttempt.blockedUntil) : null,
        lastFailedAt: new Date(loginAttempt.lastFailedAt),
      },
      create: {
        id: loginAttempt.id,
        ipAddress: loginAttempt.ipAddress,
        email: loginAttempt.email,
        failCount: loginAttempt.failCount,
        lockLevel: loginAttempt.lockLevel,
        windowStart: new Date(loginAttempt.windowStart),
        blockedUntil: loginAttempt.blockedUntil ? new Date(loginAttempt.blockedUntil) : null,
        lastFailedAt: new Date(loginAttempt.lastFailedAt),
      },
    });

    return mapLoginAttempt(attempt);
  }

  const existingIndex = db.data.loginAttempts.findIndex(
    (entry) => entry.ipAddress === loginAttempt.ipAddress && entry.email === loginAttempt.email,
  );

  if (existingIndex === -1) {
    db.data.loginAttempts.push(clone(loginAttempt));
    return loginAttempt;
  }

  db.data.loginAttempts[existingIndex] = clone(loginAttempt);
  return loginAttempt;
}

export async function deleteLoginAttempt(ipAddress, email) {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    await prisma.loginAttempt.deleteMany({
      where: {
        ipAddress,
        email,
      },
    });

    return;
  }

  db.data.loginAttempts = db.data.loginAttempts.filter(
    (entry) => !(entry.ipAddress === ipAddress && entry.email === email),
  );
}

export async function clearAllLoginAttempts() {
  ensureSupportedProvider();

  if (isRelationalProvider()) {
    const prisma = await getPrismaClient();
    await prisma.loginAttempt.deleteMany();
    return;
  }

  db.data.loginAttempts = [];
}
