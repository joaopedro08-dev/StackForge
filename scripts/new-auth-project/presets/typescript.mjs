import path from 'node:path';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { removeFileIfExists } from '../filesystem.mjs';

export async function applyTypeScriptPreset(destinationProjectDir) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.devDependencies = packageJson.devDependencies || {};
  packageJson.scripts = packageJson.scripts || {};

  if (!packageJson.devDependencies.typescript) {
    packageJson.devDependencies.typescript = '^5.8.3';
  }

  if (!packageJson.devDependencies['typescript-eslint']) {
    packageJson.devDependencies['typescript-eslint'] = '^8.58.2';
  }

  if (!packageJson.devDependencies.tsx) {
    packageJson.devDependencies.tsx = '^4.20.6';
  }

  packageJson.dependencies = packageJson.dependencies || {};
  if (!packageJson.dependencies.tsx) {
    packageJson.dependencies.tsx = packageJson.devDependencies.tsx;
  }
  if (packageJson.devDependencies.tsx) {
    delete packageJson.devDependencies.tsx;
  }

  if (!packageJson.devDependencies['@types/node']) {
    packageJson.devDependencies['@types/node'] = '^22.15.2';
  }

  if (!packageJson.devDependencies['@types/express']) {
    packageJson.devDependencies['@types/express'] = '^5.0.3';
  }

  if (!packageJson.devDependencies['@types/cors']) {
    packageJson.devDependencies['@types/cors'] = '^2.8.19';
  }

  if (!packageJson.devDependencies['@types/cookie-parser']) {
    packageJson.devDependencies['@types/cookie-parser'] = '^1.4.9';
  }

  if (!packageJson.devDependencies['@types/swagger-ui-express']) {
    packageJson.devDependencies['@types/swagger-ui-express'] = '^4.1.8';
  }

  if (!packageJson.devDependencies['@types/jsonwebtoken']) {
    packageJson.devDependencies['@types/jsonwebtoken'] = '^9.0.10';
  }

  packageJson.main = 'index.ts';
  packageJson.scripts.dev = 'tsx watch index.ts';
  packageJson.scripts.start = 'tsx index.ts';
  packageJson.scripts.typecheck = 'tsc --noEmit';

  if (packageJson.scripts['dev:ts']) {
    delete packageJson.scripts['dev:ts'];
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  const tsConfigPath = path.join(destinationProjectDir, 'tsconfig.json');
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      allowJs: false,
      noEmit: true,
      strict: false,
      noImplicitAny: false,
      resolveJsonModule: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: true,
      types: ['node', 'vitest/globals'],
    },
    include: ['index.ts', 'src/**/*.ts', 'src/**/*.d.ts', 'tests/**/*.ts', 'vitest.config.ts', 'vitest.workspace.ts'],
  };

  await writeFile(tsConfigPath, `${JSON.stringify(tsConfig, null, 2)}\n`, 'utf8');

  const vitestConfigMjsPath = path.join(destinationProjectDir, 'vitest.config.mjs');
  const vitestConfigTsPath = path.join(destinationProjectDir, 'vitest.config.ts');
  const vitestConfigStat = await stat(vitestConfigMjsPath).catch(() => null);

  if (vitestConfigStat?.isFile()) {
    const vitestConfigRaw = await readFile(vitestConfigMjsPath, 'utf8');
    const vitestConfigUpdated = vitestConfigRaw
      .replace("include: ['tests/**/*.test.js']", "include: ['tests/**/*.test.ts']")
      .replace("include: ['tests/**/*.test.{js,ts}']", "include: ['tests/**/*.test.ts']");

    await writeFile(vitestConfigTsPath, vitestConfigUpdated, 'utf8');
    await removeFileIfExists(vitestConfigMjsPath);
  }

  const vitestWorkspaceMjsPath = path.join(destinationProjectDir, 'vitest.workspace.mjs');
  const vitestWorkspaceTsPath = path.join(destinationProjectDir, 'vitest.workspace.ts');
  const vitestWorkspaceStat = await stat(vitestWorkspaceMjsPath).catch(() => null);

  if (vitestWorkspaceStat?.isFile()) {
    const vitestWorkspaceRaw = await readFile(vitestWorkspaceMjsPath, 'utf8');
    const vitestWorkspaceUpdated = vitestWorkspaceRaw.replace('./vitest.config.mjs', './vitest.config.ts');

    await writeFile(vitestWorkspaceTsPath, vitestWorkspaceUpdated, 'utf8');
    await removeFileIfExists(vitestWorkspaceMjsPath);
  }

  const eslintConfigJsPath = path.join(destinationProjectDir, 'eslint.config.js');
  const eslintConfigMjsPath = path.join(destinationProjectDir, 'eslint.config.mjs');
  const eslintConfigStat = await stat(eslintConfigJsPath).catch(() => null);

  if (eslintConfigStat?.isFile()) {
    const eslintConfigContent = `import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'data/**', 'prisma/migrations/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
);
`;

    await rename(eslintConfigJsPath, eslintConfigMjsPath).catch(() => null);
    await writeFile(eslintConfigMjsPath, eslintConfigContent, 'utf8');
  }

  await convertProjectJavaScriptFilesToTypeScript(destinationProjectDir);
  await writeExpressAugmentation(destinationProjectDir);
  await rewriteTypeScriptCoreFiles(destinationProjectDir);
  await rewriteTypeScriptRepositoryFile(destinationProjectDir);
}

async function rewriteTypeScriptRepositoryFile(destinationProjectDir) {
  const repositoryPath = path.join(destinationProjectDir, 'src', 'repositories', 'auth.repository.ts');
  const repositoryStat = await stat(repositoryPath).catch(() => null);

  if (!repositoryStat?.isFile()) {
    return;
  }

  const repositoryRaw = await readFile(repositoryPath, 'utf8');

  const repositoryTypesBlock = `
type RepositoryUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};

type RepositoryRefreshToken = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  familyExpiresAt: string;
  revokedAt: string | null;
};

type RepositoryEmailVerificationToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
};

type RepositoryLoginAttempt = {
  id: string;
  ipAddress: string;
  email: string | null;
  failCount: number;
  lockLevel: number;
  windowStart: string;
  blockedUntil: string | null;
  lastFailedAt: string;
};`;

  let repositoryUpdated = repositoryRaw
    .replace(
      "import { getPrismaClient } from '../db/prisma-client';",
      `import { getPrismaClient } from '../db/prisma-client';\n${repositoryTypesBlock}`,
    )
    .replace(/\/\*\*[\s\S]*?\*\/\r?\n/gm, '')
    .replace('function clone(value) {', 'function clone<T>(value: T): T {')
    .replace('function mapUser(user) {', 'function mapUser(user: any): RepositoryUser | null {')
    .replace(
      'function mapEmailVerificationToken(emailVerificationToken) {',
      'function mapEmailVerificationToken(emailVerificationToken: any): RepositoryEmailVerificationToken | null {',
    )
    .replace('function mapRefreshToken(refreshToken) {', 'function mapRefreshToken(refreshToken: any): RepositoryRefreshToken | null {')
    .replace('function mapLoginAttempt(loginAttempt) {', 'function mapLoginAttempt(loginAttempt: any): RepositoryLoginAttempt | null {')
    .replace('export async function findUserByEmail(email) {', 'export async function findUserByEmail(email: string): Promise<RepositoryUser | null> {')
    .replace('export async function findUserById(userId) {', 'export async function findUserById(userId: string): Promise<RepositoryUser | null> {')
    .replace('export async function createUser(user) {', 'export async function createUser(user: RepositoryUser): Promise<void> {')
    .replace(
      'export async function createRefreshToken(refreshToken) {',
      'export async function createRefreshToken(refreshToken: RepositoryRefreshToken): Promise<void> {',
    )
    .replace(
      'export async function createEmailVerificationToken(emailVerificationToken) {',
      'export async function createEmailVerificationToken(emailVerificationToken: RepositoryEmailVerificationToken): Promise<void> {',
    )
    .replace(
      'export async function findActiveEmailVerificationTokenByHash(tokenHash) {',
      'export async function findActiveEmailVerificationTokenByHash(tokenHash: string): Promise<RepositoryEmailVerificationToken | null> {',
    )
    .replace(
      'export async function markEmailVerificationTokenUsed(tokenHash, usedAt) {',
      'export async function markEmailVerificationTokenUsed(tokenHash: string, usedAt: string): Promise<RepositoryEmailVerificationToken | null> {',
    )
    .replace(
      'export async function markUserEmailVerified(userId, verifiedAt) {',
      'export async function markUserEmailVerified(userId: string, verifiedAt: string): Promise<RepositoryUser | null> {',
    )
    .replace(
      'export async function findActiveRefreshTokenByHash(tokenHash) {',
      'export async function findActiveRefreshTokenByHash(tokenHash: string): Promise<RepositoryRefreshToken | null> {',
    )
    .replace(
      'export async function revokeRefreshToken(tokenHash, revokedAt) {',
      'export async function revokeRefreshToken(tokenHash: string, revokedAt: string): Promise<void> {',
    )
    .replace(
      'export async function findRefreshTokenByHash(tokenHash) {',
      'export async function findRefreshTokenByHash(tokenHash: string): Promise<RepositoryRefreshToken | null> {',
    )
    .replace(
      'export async function revokeRefreshTokenFamily(familyId, revokedAt) {',
      'export async function revokeRefreshTokenFamily(familyId: string, revokedAt: string): Promise<void> {',
    )
    .replace('export async function writeDatabase() {', 'export async function writeDatabase(): Promise<void> {')
    .replace(
      'export async function findLoginAttempt(ipAddress, email) {',
      'export async function findLoginAttempt(ipAddress: string, email: string | null): Promise<RepositoryLoginAttempt | null> {',
    )
    .replace(
      'export async function upsertLoginAttempt(loginAttempt) {',
      'export async function upsertLoginAttempt(loginAttempt: RepositoryLoginAttempt): Promise<void> {',
    )
    .replace(
      'export async function deleteLoginAttempt(ipAddress, email) {',
      'export async function deleteLoginAttempt(ipAddress: string, email: string | null): Promise<void> {',
    )
    .replace('export async function clearAllLoginAttempts() {', 'export async function clearAllLoginAttempts(): Promise<void> {');

  // Keep only one blank line between import/type sections after JSDoc removal.
  repositoryUpdated = repositoryUpdated.replace(/\n{3,}/g, '\n\n');

  if (repositoryUpdated !== repositoryRaw) {
    await writeFile(repositoryPath, repositoryUpdated, 'utf8');
  }
}

async function writeExpressAugmentation(destinationProjectDir) {
  const typesDir = path.join(destinationProjectDir, 'src', 'types');
  await mkdir(typesDir, { recursive: true });

  const expressAugmentation = `export {};

declare global {
  namespace Express {
    interface RequestContext {
      requestId: string;
      requestStart: number;
    }

    interface AuthContext {
      userId: string;
      email: string;
    }

    interface Request {
      context?: RequestContext;
      auth?: AuthContext;
    }
  }
}
`;

  await writeFile(path.join(typesDir, 'express.d.ts'), expressAugmentation, 'utf8');
}

async function rewriteTypeScriptCoreFiles(destinationProjectDir) {
  await writeFile(
    path.join(destinationProjectDir, 'index.ts'),
    `import http from 'node:http';
import { env } from './src/config/env';
import { app } from './src/app';
import { info, error as logError } from './src/utils/logger';

const server = http.createServer(app);

server.on('error', (listenError: NodeJS.ErrnoException) => {
  if (listenError.code === 'EADDRINUSE') {
    logError('server_port_in_use', {
      port: env.PORT,
      errorCode: listenError.code,
      suggestion: 'Stop the process using port ' + env.PORT + ' or start with PORT=<free_port>.',
    });
    process.exit(1);
    return;
  }

  logError('server_listen_failed', {
    port: env.PORT,
    errorCode: listenError.code,
    errorMessage: listenError.message,
  });
  process.exit(1);
});

server.listen(env.PORT, () => {
  info('server_started', {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

function shutdown(signal: NodeJS.Signals) {
  info('server_shutdown_signal_received', { signal });

  server.close((closeError) => {
    if (closeError) {
      logError('server_shutdown_failed', {
        signal,
        errorMessage: closeError.message,
      });
      process.exit(1);
      return;
    }

    info('server_shutdown_completed', { signal });
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'utils', 'http-error.ts'),
    `export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'db', 'prisma-client.ts'),
    `type PrismaClientLike = {
  $queryRaw: (...args: unknown[]) => Promise<unknown>;
  $disconnect: () => Promise<void>;
  user: PrismaModelLike;
  refreshToken: PrismaModelLike;
  loginAttempt: PrismaModelLike;
};

import { env } from '../config/env';

type PrismaModelLike = {
  [method: string]: (...args: unknown[]) => unknown;
};

type PrismaClientConstructor = new (options: {
  datasources: {
    db: {
      url: string;
    };
  };
}) => PrismaClientLike;

let prismaClient: PrismaClientLike | null = null;

export async function getPrismaClient(): Promise<PrismaClientLike> {
  if (prismaClient) {
    return prismaClient;
  }

  const prismaModule = (await import('@prisma/client')) as {
    PrismaClient?: PrismaClientConstructor;
    default?: {
      PrismaClient?: PrismaClientConstructor;
    };
  };

  const PrismaClientClass = prismaModule.PrismaClient ?? prismaModule.default?.PrismaClient;

  if (!PrismaClientClass) {
    throw new Error('PrismaClient is not available. Run the Prisma client generation step.');
  }

  prismaClient = new PrismaClientClass({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  return prismaClient;
}
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'middlewares', 'request-context.middleware.ts'),
    `import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { info } from '../utils/logger';

const REQUEST_ID_HEADER = 'x-request-id';

function resolveRequestId(req: Request): string {
  const incomingRequestId = req.get(REQUEST_ID_HEADER);

  if (incomingRequestId && incomingRequestId.trim()) {
    return incomingRequestId.trim();
  }

  return crypto.randomUUID();
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req);
  const requestStart = Date.now();

  req.context = {
    requestId,
    requestStart,
  };

  res.setHeader(REQUEST_ID_HEADER, requestId);

  res.on('finish', () => {
    info('http_request_completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - requestStart,
      ip: req.ip,
    });
  });

  next();
}
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'middlewares', 'auth.middleware.ts'),
    `import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';
import { validateAccessToken } from '../modules/auth/auth.service';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Access token is required.');
    }

    const token = authorizationHeader.replace('Bearer ', '').trim();
    req.auth = validateAccessToken(token);

    next();
  } catch (error) {
    next(error);
  }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'middlewares', 'error.middleware.ts'),
    `import { ZodError } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';
import { error as logError } from '../utils/logger';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'Route not found.'));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): Response | void {
  void _next;

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed.',
      issues: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  logError('unhandled_error', {
    requestId: req.context?.requestId,
    path: req.originalUrl,
    method: req.method,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
  });

  return res.status(500).json({
    message: 'Internal server error.',
  });
}
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'modules', 'auth', 'auth.controller.ts'),
    `import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { CSRF_COOKIE_NAME } from '../../middlewares/csrf.middleware';
import { HttpError } from '../../utils/http-error';
import { info, warn } from '../../utils/logger';
import { loginSchema, registerSchema } from './auth.schemas';
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from './login-attempts';
import { getUserById, login, logout, refreshSession, register } from './auth.service';

const refreshCookieName = 'refreshToken';

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.NODE_ENV === 'production',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(refreshCookieName, refreshToken, getRefreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(refreshCookieName, getRefreshCookieOptions());
}

function createCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'strict' as const,
    secure: env.NODE_ENV === 'production',
    maxAge: env.CSRF_TOKEN_TTL_MINUTES * 60 * 1000,
    path: '/',
  };
}

function setCsrfCookie(res: Response, csrfToken: string): void {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());
}

function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, getCsrfCookieOptions());
}

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsedBody = registerSchema.parse(req.body);
    const result = await register(parsedBody);
    const csrfToken = createCsrfToken();

    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, csrfToken);

    info('auth_register_success', {
      requestId: req.context?.requestId,
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip,
    });

    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      csrfToken,
    });
    return;
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;

  try {
    if (await isLoginBlocked(req.ip, email)) {
      warn('auth_login_blocked', {
        requestId: req.context?.requestId,
        email,
        ip: req.ip,
      });

      throw new HttpError(429, 'Too many failed login attempts. Try again later.');
    }

    const parsedBody = loginSchema.parse(req.body);
    const result = await login(parsedBody);
    const csrfToken = createCsrfToken();

    await clearLoginFailures(req.ip, parsedBody.email);

    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, csrfToken);

    info('auth_login_success', {
      requestId: req.context?.requestId,
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip,
    });

    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      csrfToken,
    });
    return;
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 401) {
      await recordLoginFailure(req.ip, email);

      warn('auth_login_failed', {
        requestId: req.context?.requestId,
        email,
        ip: req.ip,
      });
    }

    next(error);
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Unauthorized.');
    }

    const user = await getUserById(req.auth.userId);

    res.status(200).json({ user });
    return;
  } catch (error) {
    next(error);
  }
}

export async function refreshTokenHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshTokenValue = req.cookies?.[refreshCookieName];
    const result = await refreshSession(refreshTokenValue);
    const csrfToken = createCsrfToken();

    setRefreshCookie(res, result.refreshToken);
    setCsrfCookie(res, csrfToken);

    info('auth_refresh_success', {
      requestId: req.context?.requestId,
      userId: result.user.id,
      email: result.user.email,
      ip: req.ip,
    });

    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
      csrfToken,
    });
    return;
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshTokenValue = req.cookies?.[refreshCookieName];

    await logout(refreshTokenValue);
    clearRefreshCookie(res);
    clearCsrfCookie(res);

    info('auth_logout_success', {
      requestId: req.context?.requestId,
      ip: req.ip,
    });

    res.status(200).json({ message: 'Logged out successfully.' });
    return;
  } catch (error) {
    next(error);
  }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(destinationProjectDir, 'src', 'modules', 'auth', 'auth.service.ts'),
    `import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { createId, generateRefreshToken, hashValue } from '../../utils/crypto';
import { HttpError } from '../../utils/http-error';
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
} from '../../repositories/auth.repository';

type AccessTokenContext = {
  userId: string;
  email: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RefreshTokenRecord = {
  tokenHash: string;
  userId: string;
  familyId: string;
  expiresAt: string;
  familyExpiresAt: string;
  revokedAt: string | null;
};

type AuthSessionResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

type AccessTokenClaims = JwtPayload & {
  sub: string;
  email: string;
  type: 'access';
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function isAccessTokenClaims(payload: string | JwtPayload): payload is AccessTokenClaims {
  return (
    typeof payload !== 'string' &&
    payload.type === 'access' &&
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string'
  );
}

function signAccessToken(user: Pick<AuthUser, 'id' | 'email'>): string {
  const activeKid = env.JWT_ACCESS_ACTIVE_KID;
  const keyring = env.JWT_ACCESS_KEYRING as Record<string, string | undefined>;
  const activeSecret = keyring[activeKid];

  if (!activeSecret) {
    throw new HttpError(500, 'JWT key configuration is invalid.');
  }

  const signOptions: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
    header: {
      alg: 'HS256',
      kid: activeKid,
    },
  };

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: 'access',
    },
    activeSecret as Secret,
    signOptions,
  );
}

async function issueRefreshToken(
  userId: string,
  familyId: string = createId(),
  familyExpiresAt: string | null = null,
): Promise<string> {
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

function getRefreshTokenRecord(token: string): Promise<RefreshTokenRecord | null> {
  const tokenHash = hashValue(token);

  return findRefreshTokenByHash(tokenHash) as Promise<RefreshTokenRecord | null>;
}

export async function register(payload: RegisterPayload): Promise<AuthSessionResult> {
  const email = normalizeEmail(payload.email);

  const existingUser = (await findUserByEmail(email)) as AuthUser | null;
  if (existingUser) {
    throw new HttpError(409, 'Email is already in use.');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const nowIso = new Date().toISOString();

  const user: AuthUser = {
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

export async function login(payload: LoginPayload): Promise<AuthSessionResult> {
  const email = normalizeEmail(payload.email);

  const user = (await findUserByEmail(email)) as AuthUser | null;
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

export async function refreshSession(refreshTokenValue: string | undefined): Promise<AuthSessionResult> {
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

  const user = (await findUserById(tokenRecord.userId)) as AuthUser | null;
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

export async function logout(refreshTokenValue: string | undefined): Promise<void> {
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

export function validateAccessToken(token: string): AccessTokenContext {
  try {
    const decodedToken = jwt.decode(token, { complete: true }) as
      | {
          header?: {
            kid?: string;
          };
        }
      | null;

    const headerKid = decodedToken?.header?.kid;
    const keyring = env.JWT_ACCESS_KEYRING as Record<string, string | undefined>;

    const keyCandidates: Array<[string, string | undefined]> = headerKid
      ? [[headerKid, keyring[headerKid]]]
      : Object.entries(keyring);

    for (const [, secret] of keyCandidates) {
      if (!secret) {
        continue;
      }

      try {
        const payload = jwt.verify(token, secret as Secret) as string | JwtPayload;

        if (!isAccessTokenClaims(payload)) {
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

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = (await findUserById(userId)) as AuthUser | null;

  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return publicUser(user);
}
`,
    'utf8',
  );
}

async function renameJavaScriptFilesRecursively(baseDir) {
  const entries = await readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      await renameJavaScriptFilesRecursively(entryPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      const renamedPath = entryPath.slice(0, -3) + '.ts';
      await rename(entryPath, renamedPath);
    }
  }
}

async function convertProjectJavaScriptFilesToTypeScript(destinationProjectDir) {
  const rootIndexPath = path.join(destinationProjectDir, 'index.js');
  const rootIndexStat = await stat(rootIndexPath).catch(() => null);

  if (rootIndexStat?.isFile()) {
    await rename(rootIndexPath, path.join(destinationProjectDir, 'index.ts'));
  }

  const srcDir = path.join(destinationProjectDir, 'src');
  const srcDirStat = await stat(srcDir).catch(() => null);
  if (srcDirStat?.isDirectory()) {
    await renameJavaScriptFilesRecursively(srcDir);
  }

  const testsDir = path.join(destinationProjectDir, 'tests');
  const testsDirStat = await stat(testsDir).catch(() => null);
  if (testsDirStat?.isDirectory()) {
    await renameJavaScriptFilesRecursively(testsDir);
  }

  await stripJsExtensionsFromTypeScriptFiles(destinationProjectDir);
}

async function stripJsExtensionsFromTypeScriptFiles(baseDir) {
  const entries = await readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      await stripJsExtensionsFromTypeScriptFiles(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      continue;
    }

    const fileRaw = await readFile(entryPath, 'utf8');
    const updatedFile = fileRaw
      .replace(/(from\s+['"](?:\.\.?\/[^'"]+))\.js(['"])/g, '$1$2')
      .replace(/(import\(\s*['"](?:\.\.?\/[^'"]+))\.js(['"]\s*\))/g, '$1$2')
      .replace(/(export\s+\*\s+from\s+['"](?:\.\.?\/[^'"]+))\.js(['"])/g, '$1$2');

    if (updatedFile !== fileRaw) {
      await writeFile(entryPath, updatedFile, 'utf8');
    }
  }
}
