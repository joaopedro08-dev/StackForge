import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { createId, generateRefreshToken, hashValue } from '../../utils/crypto.js';
import { HttpError } from '../../utils/http-error.js';
import {
  createRefreshToken,
  createUser,
  findActiveRefreshTokenByHash,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  writeDatabase,
} from '../../repositories/auth.repository.js';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function signAccessToken(user) {
  const activeKid = env.JWT_ACCESS_ACTIVE_KID;
  const activeSecret = env.JWT_ACCESS_KEYRING[activeKid];

  if (!activeSecret) {
    throw new HttpError(500, 'JWT key configuration is invalid.');
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: 'access',
    },
    activeSecret,
    {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
      header: {
        kid: activeKid,
      },
    },
  );
}

async function issueRefreshToken(userId, familyId = createId()) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashValue(refreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await createRefreshToken({
    id: createId(),
    userId,
    familyId,
    tokenHash: refreshTokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
  });

  return refreshToken;
}

function getActiveRefreshTokenRecord(token) {
  const tokenHash = hashValue(token);

  return findActiveRefreshTokenByHash(tokenHash);
}

function getRefreshTokenRecord(token) {
  const tokenHash = hashValue(token);

  return findRefreshTokenByHash(tokenHash);
}

export async function register(payload) {
  const email = normalizeEmail(payload.email);

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new HttpError(409, 'Email is already in use.');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const nowIso = new Date().toISOString();

  const user = {
    id: createId(),
    name: payload.name.trim(),
    email,
    passwordHash,
    createdAt: nowIso,
  };

  await createUser(user);

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  await writeDatabase();

  return {
    user: publicUser(user),
    accessToken,
    refreshToken,
  };
}

export async function login(payload) {
  const email = normalizeEmail(payload.email);

  const user = await findUserByEmail(email);
  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  await writeDatabase();

  return {
    user: publicUser(user),
    accessToken,
    refreshToken,
  };
}

export async function refreshSession(refreshTokenValue) {
  if (!refreshTokenValue) {
    throw new HttpError(401, 'Refresh token missing.');
  }

  const tokenRecord = await getRefreshTokenRecord(refreshTokenValue);

  if (!tokenRecord) {
    throw new HttpError(401, 'Invalid refresh token.');
  }

  if (tokenRecord.revokedAt) {
    await revokeRefreshTokenFamily(tokenRecord.familyId, new Date().toISOString());
    await writeDatabase();
    throw new HttpError(401, 'Refresh token reuse detected. Session revoked.');
  }

  if (new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
    throw new HttpError(401, 'Invalid refresh token.');
  }

  await revokeRefreshToken(tokenRecord.tokenHash, new Date().toISOString());

  const user = await findUserById(tokenRecord.userId);
  if (!user) {
    throw new HttpError(401, 'Invalid refresh token.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, tokenRecord.familyId);

  await writeDatabase();

  return {
    user: publicUser(user),
    accessToken,
    refreshToken,
  };
}

export async function logout(refreshTokenValue) {
  if (!refreshTokenValue) {
    throw new HttpError(401, 'Unable to end the session. Please log in again.');
  }

  const tokenRecord = await getActiveRefreshTokenRecord(refreshTokenValue);
  if (!tokenRecord) {
    throw new HttpError(401, 'Session is invalid or expired. Please log in again.');
  }

  await revokeRefreshToken(tokenRecord.tokenHash, new Date().toISOString());
  await writeDatabase();
}

export function validateAccessToken(token) {
  try {
    const decodedToken = jwt.decode(token, { complete: true });
    const headerKid = decodedToken?.header?.kid;

    const keyCandidates = headerKid
      ? [[headerKid, env.JWT_ACCESS_KEYRING[headerKid]]]
      : Object.entries(env.JWT_ACCESS_KEYRING);

    for (const [, secret] of keyCandidates) {
      if (!secret) {
        continue;
      }

      try {
        const payload = jwt.verify(token, secret);

        if (!payload || payload.type !== 'access') {
          throw new HttpError(401, 'Invalid access token.');
        }

        return {
          userId: payload.sub,
          email: payload.email,
        };
      } catch {
        // Try next key when available.
      }
    }

    throw new HttpError(401, 'Invalid or expired access token.');
  } catch {
    throw new HttpError(401, 'Invalid or expired access token.');
  }
}

export async function getUserById(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return publicUser(user);
}
