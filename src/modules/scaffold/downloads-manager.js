import crypto from 'node:crypto';
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../../utils/http-error.js';

const DOWNLOAD_TTL_HOURS = 24; // Token valid for 24 hours
const DOWNLOAD_RETENTION_DAYS = 7; // Keep ZIPs for 7 days
const CLEANUP_INTERVAL_HOURS = 1; // Run cleanup every hour

let tokenStore = new Map(); // In-memory token store: token -> { filename, downloadsDir, expiresAt }
let cleanupIntervalId = null;
let activeDownloadsDir = '';

function removeTokenEntriesForFilename(filename) {
  for (const [token, entry] of tokenStore) {
    if (entry.filename === filename) {
      tokenStore.delete(token);
    }
  }
}

export async function removeDownloadFile(downloadsDir, filename) {
  const filePath = path.join(downloadsDir, filename);

  try {
    await rm(filePath, { force: true });
    removeTokenEntriesForFilename(filename);
    return true;
  } catch {
    return false;
  }
}

export function initializeDownloadsManager(downloadsDir) {
  activeDownloadsDir = downloadsDir;

  // Start automatic cleanup
  startPeriodicCleanup(downloadsDir);
}

export function generateDownloadToken(filename) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + DOWNLOAD_TTL_HOURS * 60 * 60 * 1000;

  tokenStore.set(token, {
    filename,
    downloadsDir: activeDownloadsDir,
    expiresAt,
  });

  return token;
}

export function validateDownloadToken(token) {
  const entry = tokenStore.get(token);

  if (!entry) {
    throw new HttpError(404, 'Download token not found or expired.');
  }

  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    throw new HttpError(410, 'Download token has expired.');
  }

  return entry;
}

function startPeriodicCleanup(downloadsDir) {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
  }

  // Run cleanup immediately on startup
  cleanupOldDownloads(downloadsDir).catch((error) => {
    console.error('Initial cleanup failed:', error.message);
  });

  // Then run periodically
  cleanupIntervalId = setInterval(() => {
    cleanupOldDownloads(downloadsDir).catch((error) => {
      console.error('Periodic cleanup failed:', error.message);
    });
  }, CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
}

async function cleanupOldDownloads(downloadsDir) {
  try {
    const files = await readdir(downloadsDir);
    const now = Date.now();
    const retentionMs = DOWNLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(downloadsDir, file);

      try {
        const stats = await stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > retentionMs) {
          await removeDownloadFile(downloadsDir, file);
          deletedCount += 1;
        }
      } catch {
        // Skip files that can't be accessed
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old download files.`);
    }
  } catch {
    // Silently ignore cleanup errors
  }
}

export function stopPeriodicCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

export async function cleanupAllDownloads(downloadsDir) {
  let deletedCount = 0;

  try {
    const files = await readdir(downloadsDir);

    for (const file of files) {
      const removed = await removeDownloadFile(downloadsDir, file);

      if (removed) {
        deletedCount += 1;
      }
    }
  } catch {
    // Missing folder or read errors should not crash the request.
  }

  return deletedCount;
}

// Cleanup expired tokens from memory
export function cleanupExpiredTokens() {
  const now = Date.now();
  let expiredCount = 0;

  for (const [token, entry] of tokenStore) {
    if (now > entry.expiresAt) {
      tokenStore.delete(token);
      expiredCount += 1;
    }
  }

  if (expiredCount > 0) {
    console.log(`Cleaned up ${expiredCount} expired download tokens.`);
  }
}

// Get download info for admin purposes
export function getDownloadsInfo() {
  return {
    tokenStore: {
      activeTokens: tokenStore.size,
      tokens: Array.from(tokenStore.entries()).map(([token, entry]) => ({
        token: token.slice(0, 8) + '...',
        filename: entry.filename,
        expiresAt: new Date(entry.expiresAt).toISOString(),
      })),
    },
    config: {
      tokenTtlHours: DOWNLOAD_TTL_HOURS,
      retentionDays: DOWNLOAD_RETENTION_DAYS,
      cleanupIntervalHours: CLEANUP_INTERVAL_HOURS,
    },
  };
}
