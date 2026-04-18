import { env } from '../../config/env.js';
import { createId } from '../../utils/crypto.js';
import {
  clearAllLoginAttempts,
  deleteLoginAttempt,
  findLoginAttempt,
  upsertLoginAttempt,
  writeDatabase,
} from '../../repositories/auth.repository.js';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function buildAttemptRecord(ipAddress, email, now) {
  return {
    id: createId(),
    ipAddress,
    email: normalizeEmail(email),
    failCount: 1,
    lockLevel: 0,
    windowStart: new Date(now).toISOString(),
    blockedUntil: null,
    lastFailedAt: new Date(now).toISOString(),
  };
}

function isWindowExpired(windowStartTimestamp, nowTimestamp) {
  return nowTimestamp - windowStartTimestamp > env.LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000;
}

function getBlockedMinutes(lockLevel) {
  const base = env.LOGIN_BLOCK_DURATION_MINUTES;
  const multiplier = env.LOGIN_BLOCK_BACKOFF_MULTIPLIER;
  const value = base * multiplier ** Math.max(lockLevel - 1, 0);

  return Math.min(value, env.LOGIN_MAX_BLOCK_DURATION_MINUTES);
}

export async function resetLoginAttemptsForTests() {
  await clearAllLoginAttempts();
  await writeDatabase();
}

export async function isLoginBlocked(ipAddress, email) {
  if (!email) {
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  const record = await findLoginAttempt(ipAddress, normalizedEmail);

  if (!record?.blockedUntil) {
    return false;
  }

  const now = Date.now();
  const blockedUntilTimestamp = new Date(record.blockedUntil).getTime();

  if (blockedUntilTimestamp <= now) {
    await deleteLoginAttempt(ipAddress, normalizedEmail);
    await writeDatabase();
    return false;
  }

  return true;
}

export async function recordLoginFailure(ipAddress, email) {
  if (!email) {
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const existingRecord = await findLoginAttempt(ipAddress, normalizedEmail);

  if (!existingRecord) {
    await upsertLoginAttempt(buildAttemptRecord(ipAddress, normalizedEmail, now));
    await writeDatabase();
    return;
  }

  const windowStartTimestamp = new Date(existingRecord.windowStart).getTime();
  const isExpired = Number.isNaN(windowStartTimestamp) || isWindowExpired(windowStartTimestamp, now);

  const nextFailCount = isExpired ? 1 : existingRecord.failCount + 1;
  const lockLevel = existingRecord.lockLevel ?? 0;
  const shouldBlock = nextFailCount >= env.LOGIN_MAX_FAILED_ATTEMPTS;
  const nextLockLevel = shouldBlock ? lockLevel + 1 : lockLevel;

  const blockedMinutes = shouldBlock ? getBlockedMinutes(nextLockLevel) : 0;
  const blockedUntil = shouldBlock ? new Date(now + blockedMinutes * 60 * 1000).toISOString() : null;

  await upsertLoginAttempt({
    id: existingRecord.id,
    ipAddress,
    email: normalizedEmail,
    failCount: shouldBlock ? 0 : nextFailCount,
    lockLevel: nextLockLevel,
    windowStart: isExpired ? new Date(now).toISOString() : existingRecord.windowStart,
    blockedUntil,
    lastFailedAt: new Date(now).toISOString(),
  });

  await writeDatabase();
}

export async function clearLoginFailures(ipAddress, email) {
  if (!email) {
    return;
  }

  await deleteLoginAttempt(ipAddress, normalizeEmail(email));
  await writeDatabase();
}
