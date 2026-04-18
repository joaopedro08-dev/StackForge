import crypto from 'node:crypto';

export function createId() {
  return crypto.randomUUID();
}

export function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}
