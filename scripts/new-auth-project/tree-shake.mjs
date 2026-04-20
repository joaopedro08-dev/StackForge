import path from 'node:path';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';

function hasAuthFeature(featureSet) {
  return featureSet === 'auth' || featureSet === 'both';
}

function hasEmailFeature(featureSet) {
  return featureSet === 'email' || featureSet === 'both';
}

function isGraphQlEnabled(apiStyle) {
  return apiStyle === 'graphql' || apiStyle === 'hybrid';
}

async function fileExists(filePath) {
  const fileStat = await stat(filePath).catch(() => null);
  return Boolean(fileStat?.isFile());
}

async function removeIfExists(filePath) {
  await rm(filePath, { force: true }).catch(() => null);
}

function getImportExtension(language) {
  return language === 'typescript' ? '' : '.js';
}

function buildHealthFileContent(databaseProvider, language) {
  const ext = getImportExtension(language);

  if (databaseProvider === 'json') {
    return `import { env } from '../config/env${ext}';
import { db } from './database${ext}';

function isRelationalProvider(provider) {
  return ['postgresql', 'mysql', 'sqlite', 'sqlserver'].includes(provider);
}

async function checkJsonProvider() {
  return Boolean(db?.data && Array.isArray(db.data.users) && Array.isArray(db.data.refreshTokens));
}

export async function checkDatabaseReadiness() {
  try {
    if (env.DATABASE_PROVIDER === 'json') {
      return {
        ok: await checkJsonProvider(),
        provider: 'json',
      };
    }

    if (isRelationalProvider(env.DATABASE_PROVIDER)) {
      return {
        ok: false,
        provider: env.DATABASE_PROVIDER,
        reason: 'provider-not-configured-for-json-build',
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
`;
  }

  return `import { env } from '../config/env${ext}';
import { getPrismaClient } from './prisma-client${ext}';

function isRelationalProvider(provider) {
  return ['postgresql', 'mysql', 'sqlite', 'sqlserver'].includes(provider);
}

async function checkRelationalProvider() {
  const prisma = await getPrismaClient();
  await prisma.$queryRaw\`SELECT 1\`;
  return true;
}

export async function checkDatabaseReadiness() {
  try {
    if (isRelationalProvider(env.DATABASE_PROVIDER)) {
      return {
        ok: await checkRelationalProvider(),
        provider: env.DATABASE_PROVIDER,
      };
    }

    if (env.DATABASE_PROVIDER === 'json') {
      return {
        ok: false,
        provider: 'json',
        reason: 'provider-not-configured-for-relational-build',
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
`;
}

function removeAppAuthBlock(source) {
  return source
    .replace(/^import cookieParser from 'cookie-parser';\r?\n/m, '')
    .replace(/^import \{ authRateLimiter \} from '\.\/middlewares\/rate-limit\.middleware(?:\.js)?';\r?\n/m, '')
    .replace(/^import \{ authRouter \} from '\.\/(?:modules\/auth|interfaces\/http)\/auth\.routes(?:\.js)?';\r?\n/m, '')
    .replace(/^[ \t]*if \(\['rest', 'hybrid'\]\.includes\(env\.API_STYLE\)\) \{\r?\n[ \t]*app\.use\('\/auth', authRateLimiter, authRouter\);\r?\n[ \t]*\}\r?\n/m, '')
    .replace(/^[ \t]*app\.use\('\/auth', authRateLimiter, authRouter\);\r?\n/m, '')
    .replace(/^[ \t]*app\.use\(cookieParser\(\)\);\r?\n/m, '');
}

function removeAppEmailBlock(source) {
  return source
    .replace(/^import \{ emailRouter \} from '\.\/(?:modules\/email|interfaces\/http)\/email\.routes(?:\.js)?';\r?\n/m, '')
    .replace(/^[ \t]*if \(env\.EMAIL_ENABLED\) \{\r?\n[ \t]*app\.use\('\/email', emailRouter\);\r?\n[ \t]*\}\r?\n/m, '')
    .replace(
      /function resolveOpenApiDocument\(\) \{\r?\n[ \t]*if \(env\.EMAIL_ENABLED\) \{\r?\n[ \t]*return openApiDocument;\r?\n[ \t]*\}\r?\n\r?\n[ \t]*const clonedDocument = structuredClone\(openApiDocument\);\r?\n[ \t]*delete clonedDocument\.paths\['\/email\/send'\];\r?\n[ \t]*return clonedDocument;\r?\n\}/m,
      'function resolveOpenApiDocument() {\n  return openApiDocument;\n}',
    );
}

function removeGraphQlRuntime(source) {
  return source
    .replace(/\nasync function mountGraphQLIfEnabled\(appInstance\) \{[\s\S]*?\n\}\n\n/m, '\n')
    .replace(/^[ \t]*void mountGraphQLIfEnabled\(app\);\r?\n/m, '');
}

function ensureGraphQlRuntime(source, language) {
  if (source.includes('async function mountGraphQLIfEnabled(appInstance)')) {
    return source;
  }

  const importExt = getImportExtension(language);
  const graphQlImportPath = `./graphql/server${importExt}`;
  const mountFn = `\nasync function mountGraphQLIfEnabled(appInstance) {\n  if (!['graphql', 'hybrid'].includes(env.API_STYLE)) {\n    return;\n  }\n\n  const { mountGraphQLApi } = await import('${graphQlImportPath}');\n  await mountGraphQLApi(appInstance);\n}\n`;

  if (source.includes("import { env } from './config/env")) {
    return source.replace(/(import \{ env \} from '\.\/config\/env(?:\.js)?';\r?\n)/, `$1${mountFn}`);
  }

  return `${mountFn}\n${source}`;
}

function ensureGraphQlInvocation(source) {
  if (source.includes('void mountGraphQLIfEnabled(app);')) {
    return source;
  }

  if (source.includes("app.use(notFoundHandler);")) {
    return source.replace("app.use(notFoundHandler);", "void mountGraphQLIfEnabled(app);\n\n  app.use(notFoundHandler);");
  }

  return `${source}\nvoid mountGraphQLIfEnabled(app);\n`;
}

function normalizeAppSpacing(source) {
  return source
    .replace(/\}\);(?:\r?\n[ \t]*)*app\.use\(notFoundHandler\);/g, '});\n\n  app.use(notFoundHandler);')
    .replace(/\n{3,}/g, '\n\n');
}

async function ensureCleanRouteAdapters(destinationProjectDir, language, authEnabled, emailEnabled) {
  const extension = language === 'typescript' ? '.ts' : '.js';
  const importExt = getImportExtension(language);
  const interfacesHttpDir = path.join(destinationProjectDir, 'src', 'interfaces', 'http');
  await mkdir(interfacesHttpDir, { recursive: true });

  const authRoutesAdapterPath = path.join(interfacesHttpDir, `auth.routes${extension}`);
  const emailRoutesAdapterPath = path.join(interfacesHttpDir, `email.routes${extension}`);

  if (authEnabled) {
    await writeFile(
      authRoutesAdapterPath,
      `import { authRouter } from '../../modules/auth/auth.routes${importExt}';\n\nexport { authRouter };\n`,
      'utf8',
    );
  } else {
    await removeIfExists(authRoutesAdapterPath);
  }

  if (emailEnabled) {
    await writeFile(
      emailRoutesAdapterPath,
      `import { emailRouter } from '../../modules/email/email.routes${importExt}';\n\nexport { emailRouter };\n`,
      'utf8',
    );
  } else {
    await removeIfExists(emailRoutesAdapterPath);
  }
}

async function updateGeneratedAppRuntime(destinationProjectDir, options) {
  const extension = options.language === 'typescript' ? '.ts' : '.js';
  const appPath = path.join(destinationProjectDir, 'src', `app${extension}`);
  const appExists = await fileExists(appPath);
  if (!appExists) {
    return;
  }

  const authEnabled = hasAuthFeature(options.featureSet);
  const emailEnabled = hasEmailFeature(options.featureSet);
  const graphQlEnabled = isGraphQlEnabled(options.apiStyle);
  const importExt = getImportExtension(options.language);

  let appUpdated = await readFile(appPath, 'utf8');

  if (options.architecture === 'clean') {
    appUpdated = appUpdated
      .replace(
        /import \{ authRouter \} from '\.\/modules\/auth\/auth\.routes(?:\.js)?';\r?\n/m,
        `import { authRouter } from './interfaces/http/auth.routes${importExt}';\n`,
      )
      .replace(
        /import \{ emailRouter \} from '\.\/modules\/email\/email\.routes(?:\.js)?';\r?\n/m,
        `import { emailRouter } from './interfaces/http/email.routes${importExt}';\n`,
      );
  }

  if (!authEnabled) {
    appUpdated = removeAppAuthBlock(appUpdated);
  }

  if (!emailEnabled) {
    appUpdated = removeAppEmailBlock(appUpdated);
  }

  if (!graphQlEnabled) {
    appUpdated = removeGraphQlRuntime(appUpdated);
  } else {
    appUpdated = ensureGraphQlRuntime(appUpdated, options.language);
    appUpdated = ensureGraphQlInvocation(appUpdated);
  }

  appUpdated = normalizeAppSpacing(appUpdated);

  await writeFile(appPath, appUpdated, 'utf8');
}

async function removeFeatureFiles(destinationProjectDir, options) {
  const extension = options.language === 'typescript' ? '.ts' : '.js';
  const authEnabled = hasAuthFeature(options.featureSet);
  const emailEnabled = hasEmailFeature(options.featureSet);
  const graphQlEnabled = isGraphQlEnabled(options.apiStyle);

  if (!authEnabled) {
    await removeIfExists(path.join(destinationProjectDir, 'src', 'middlewares', `auth.middleware${extension}`));
    await removeIfExists(path.join(destinationProjectDir, 'src', 'middlewares', `csrf.middleware${extension}`));
    await removeIfExists(path.join(destinationProjectDir, 'src', 'middlewares', `rate-limit.middleware${extension}`));
    await rm(path.join(destinationProjectDir, 'src', 'modules', 'auth'), { recursive: true, force: true }).catch(() => null);
  }

  if (!emailEnabled) {
    await rm(path.join(destinationProjectDir, 'src', 'modules', 'email'), { recursive: true, force: true }).catch(() => null);
  }

  if (!graphQlEnabled) {
    await rm(path.join(destinationProjectDir, 'src', 'graphql'), { recursive: true, force: true }).catch(() => null);
  }
}

async function updateGeneratedDbRuntime(destinationProjectDir, options) {
  const extension = options.language === 'typescript' ? '.ts' : '.js';
  const dbDir = path.join(destinationProjectDir, 'src', 'db');
  const databasePath = path.join(dbDir, `database${extension}`);
  const prismaClientPath = path.join(dbDir, `prisma-client${extension}`);
  const healthPath = path.join(dbDir, `health${extension}`);

  if (options.database === 'json') {
    await removeIfExists(prismaClientPath);
  } else {
    await removeIfExists(databasePath);
  }

  const healthContent = buildHealthFileContent(options.database, options.language);
  await writeFile(healthPath, healthContent, 'utf8');
}

export async function applyGeneratedTreeShaking(destinationProjectDir, options) {
  const authEnabled = hasAuthFeature(options.featureSet);
  const emailEnabled = hasEmailFeature(options.featureSet);

  if (options.architecture === 'clean') {
    await ensureCleanRouteAdapters(destinationProjectDir, options.language, authEnabled, emailEnabled);
  }

  await updateGeneratedAppRuntime(destinationProjectDir, options);
  await removeFeatureFiles(destinationProjectDir, options);
  await updateGeneratedDbRuntime(destinationProjectDir, options);
}
