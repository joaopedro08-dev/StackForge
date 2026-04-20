import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { createId, generateRefreshToken, hashValue } from '../../utils/crypto.js';
import { HttpError } from '../../utils/http-error.js';
import {
  createEmailVerificationToken,
  createRefreshToken,
  createUser,
  findActiveEmailVerificationTokenByHash,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  markEmailVerificationTokenUsed,
  markUserEmailVerified,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  writeDatabase,
} from '../../repositories/auth.repository.js';
import { sendEmail } from '../email/email.service.js';

const revokedAccessTokenHashes = new Map();

function cleanupRevokedAccessTokens(now = Date.now()) {
  for (const [tokenHash, expiresAt] of revokedAccessTokenHashes) {
    if (expiresAt <= now) {
      revokedAccessTokenHashes.delete(tokenHash);
    }
  }
}

function getDecodedTokenExpirationMs(token) {
  const decoded = jwt.decode(token);
  const expiration = decoded?.exp;

  if (typeof expiration !== 'number') {
    return null;
  }

  return expiration * 1000;
}

function isAccessTokenRevoked(token) {
  cleanupRevokedAccessTokens();
  return revokedAccessTokenHashes.has(hashValue(token));
}

export function revokeAccessToken(token) {
  if (!token) {
    return;
  }

  const expiresAtMs = getDecodedTokenExpirationMs(token);
  if (!expiresAtMs || expiresAtMs <= Date.now()) {
    return;
  }

  revokedAccessTokenHashes.set(hashValue(token), expiresAtMs);
}

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

async function issueRefreshToken(userId, familyId = createId(), familyExpiresAt = null) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashValue(refreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const familyExpiresAtIso =
    familyExpiresAt ??
    new Date(now.getTime() + env.REFRESH_TOKEN_ABSOLUTE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await createRefreshToken({
    id: createId(),
    userId,
    familyId,
    tokenHash: refreshTokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    familyExpiresAt: familyExpiresAtIso,
    revokedAt: null,
  });

  return refreshToken;
}

async function issueEmailVerificationToken(user) {
  const verificationToken = generateRefreshToken();
  const verificationTokenHash = hashValue(verificationToken);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  await createEmailVerificationToken({
    id: createId(),
    userId: user.id,
    tokenHash: verificationTokenHash,
    expiresAt,
    usedAt: null,
  });

  await sendEmail({
    to: user.email,
    subject: 'Verify your email address',
    text: `Your verification token is: ${verificationToken}`,
    html: `<p>Your verification token is: <strong>${verificationToken}</strong></p>`,
  });
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
    emailVerified: !env.EMAIL_ENABLED,
    emailVerifiedAt: env.EMAIL_ENABLED ? null : nowIso,
    createdAt: nowIso,
  };

  await createUser(user);

  if (!user.emailVerified) {
    await issueEmailVerificationToken(user);
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

  if (user.emailVerified === false) {
    throw new HttpError(403, 'Email not verified. Please verify your email address.');
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

  const familyExpiresAt = tokenRecord.familyExpiresAt ?? tokenRecord.expiresAt;

  if (new Date(familyExpiresAt).getTime() <= Date.now()) {
    await revokeRefreshTokenFamily(tokenRecord.familyId, new Date().toISOString());
    await writeDatabase();
    throw new HttpError(401, 'Session expired. Please log in again.');
  }

  await revokeRefreshToken(tokenRecord.tokenHash, new Date().toISOString());

  const user = await findUserById(tokenRecord.userId);
  if (!user) {
    throw new HttpError(401, 'Invalid refresh token.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, tokenRecord.familyId, familyExpiresAt);

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

  const tokenRecord = await getRefreshTokenRecord(refreshTokenValue);
  if (!tokenRecord) {
    throw new HttpError(401, 'Session is invalid or expired. Please log in again.');
  }

  await revokeRefreshTokenFamily(tokenRecord.familyId, new Date().toISOString());
  await writeDatabase();
}

export function validateAccessToken(token) {
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

      if (isAccessTokenRevoked(token)) {
        throw new HttpError(401, 'Access token has been revoked.');
      }

      return {
        userId: payload.sub,
        email: payload.email,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Try next key when available.
    }
  }

  throw new HttpError(401, 'Invalid or expired access token.');
}

export function clearAccessTokenBlacklistForTests() {
  revokedAccessTokenHashes.clear();
}

export async function verifyEmailToken(token) {
  const tokenHash = hashValue(token);
  const verificationRecord = await findActiveEmailVerificationTokenByHash(tokenHash);

  if (!verificationRecord) {
    throw new HttpError(400, 'Invalid or expired verification token.');
  }

  const verifiedAt = new Date().toISOString();
  await markEmailVerificationTokenUsed(tokenHash, verifiedAt);
  const user = await markUserEmailVerified(verificationRecord.userId, verifiedAt);
  await writeDatabase();

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return publicUser(user);
}

export async function getUserById(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return publicUser(user);
}
