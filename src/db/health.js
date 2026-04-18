import { env } from '../config/env.js';
import { db } from './database.js';
import { getPrismaClient } from './prisma-client.js';

async function checkJsonProvider() {
  return Boolean(db?.data && Array.isArray(db.data.users) && Array.isArray(db.data.refreshTokens));
}

async function checkPostgreSQLProvider() {
  const prisma = await getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

export async function checkDatabaseReadiness() {
  try {
    if (env.DATABASE_PROVIDER === 'json') {
      return {
        ok: await checkJsonProvider(),
        provider: 'json',
      };
    }

    if (env.DATABASE_PROVIDER === 'postgresql') {
      return {
        ok: await checkPostgreSQLProvider(),
        provider: 'postgresql',
      };
    }

    return {
      ok: false,
      provider: env.DATABASE_PROVIDER,
      reason: 'provider-not-implemented',
    };
  } catch (error) {
    return {
      ok: false,
      provider: env.DATABASE_PROVIDER,
      reason: error instanceof Error ? error.message : 'database-check-failed',
    };
  }
}
