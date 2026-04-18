import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_PROVIDER: z.enum(['json', 'mysql', 'postgresql', 'sqlite', 'sqlserver']).default('json'),
  DATABASE_URL: z.string().default(''),
  DB_PORT_MYSQL: z.coerce.number().int().nonnegative().default(3306),
  DB_PORT_POSTGRESQL: z.coerce.number().int().nonnegative().default(5432),
  DB_PORT_SQLITE: z.coerce.number().int().nonnegative().default(0),
  DB_PORT_SQLSERVER: z.coerce.number().int().nonnegative().default(1433),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  LOGIN_ATTEMPT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_BLOCK_DURATION_MINUTES: z.coerce.number().int().positive().default(15),
  LOGIN_BLOCK_BACKOFF_MULTIPLIER: z.coerce.number().int().min(1).default(2),
  LOGIN_MAX_BLOCK_DURATION_MINUTES: z.coerce.number().int().positive().default(240),
  CSRF_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(120),
  JWT_ACCESS_ACTIVE_KID: z.string().min(1).default('v1'),
  JWT_ACCESS_SECRETS: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(16).default('change-this-access-secret-please'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

const corsOrigins = parsedEnv.data.CORS_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function getDatabasePortByProvider(config) {
  if (config.DATABASE_PROVIDER === 'postgresql') {
    return config.DB_PORT_POSTGRESQL;
  }

  if (config.DATABASE_PROVIDER === 'mysql') {
    return config.DB_PORT_MYSQL;
  }

  if (config.DATABASE_PROVIDER === 'sqlserver') {
    return config.DB_PORT_SQLSERVER;
  }

  return config.DB_PORT_SQLITE;
}

function getDefaultDatabaseUrl(config) {
  if (config.DATABASE_PROVIDER === 'postgresql') {
    return `postgresql://postgres:postgres@localhost:${config.DB_PORT_POSTGRESQL}/authentication_api?schema=public`;
  }

  if (config.DATABASE_PROVIDER === 'mysql') {
    return `mysql://root:root@localhost:${config.DB_PORT_MYSQL}/authentication_api`;
  }

  if (config.DATABASE_PROVIDER === 'sqlserver') {
    return `sqlserver://sa:yourStrong(!)Password@localhost:${config.DB_PORT_SQLSERVER}?database=authentication_api`;
  }

  if (config.DATABASE_PROVIDER === 'sqlite') {
    return 'file:./prisma/dev.db';
  }

  return '';
}

function applyProviderPort(databaseUrl, config) {
  if (!databaseUrl || config.DATABASE_PROVIDER === 'json' || config.DATABASE_PROVIDER === 'sqlite') {
    return databaseUrl;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    parsedUrl.port = String(getDatabasePortByProvider(config));
    return parsedUrl.toString();
  } catch {
    return databaseUrl;
  }
}

function resolveDatabaseUrl(config) {
  const explicitDatabaseUrl = config.DATABASE_URL.trim();

  if (explicitDatabaseUrl) {
    return applyProviderPort(explicitDatabaseUrl, config);
  }

  return getDefaultDatabaseUrl(config);
}

const resolvedDatabaseUrl = resolveDatabaseUrl(parsedEnv.data);

const jwtAccessKeyring = {};

for (const entry of parsedEnv.data.JWT_ACCESS_SECRETS.split(',')) {
  const trimmedEntry = entry.trim();

  if (!trimmedEntry) {
    continue;
  }

  const [kid, ...secretParts] = trimmedEntry.split(':');
  const secret = secretParts.join(':').trim();

  if (!kid || !secret) {
    continue;
  }

  jwtAccessKeyring[kid.trim()] = secret;
}

if (!jwtAccessKeyring[parsedEnv.data.JWT_ACCESS_ACTIVE_KID]) {
  jwtAccessKeyring[parsedEnv.data.JWT_ACCESS_ACTIVE_KID] = parsedEnv.data.JWT_ACCESS_SECRET;
}

export const env = {
  ...parsedEnv.data,
  DATABASE_URL: resolvedDatabaseUrl,
  CORS_ALLOWED_ORIGINS: corsOrigins.length > 0 ? corsOrigins : [parsedEnv.data.CORS_ORIGIN],
  JWT_ACCESS_KEYRING: jwtAccessKeyring,
};
