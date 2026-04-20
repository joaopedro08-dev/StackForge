import path from 'node:path';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

const emailOpenApiPathBlock = `,
    '/email/send': {
      post: {
        summary: 'Send an email using configured SMTP provider',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  to: { type: 'string', format: 'email' },
                  subject: { type: 'string' },
                  text: { type: 'string' },
                  html: { type: 'string' },
                },
                required: ['to', 'subject', 'text'],
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Email queued for delivery',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    delivery: {
                      type: 'object',
                      properties: {
                        messageId: { type: 'string' },
                        accepted: { type: 'array', items: { type: 'string' } },
                        rejected: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                  required: ['message', 'delivery'],
                },
              },
            },
          },
          400: {
            description: 'Email provider disabled or invalid payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'SMTP configuration or transport error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    }`;

function hasAuthFeature(featureSet) {
  return featureSet === 'auth' || featureSet === 'both';
}

function hasEmailFeature(featureSet) {
  return featureSet === 'email' || featureSet === 'both';
}

const readmeEmailSectionStartMarker = '<!-- generated-email-api:start -->';
const readmeEmailSectionEndMarker = '<!-- generated-email-api:end -->';
const readmeAuthSectionStartMarker = '<!-- generated-auth-api:start -->';
const readmeAuthSectionEndMarker = '<!-- generated-auth-api:end -->';
const readmeGraphQlSectionStartMarker = '<!-- generated-graphql-api:start -->';
const readmeGraphQlSectionEndMarker = '<!-- generated-graphql-api:end -->';

const readmeAuthSectionBlock = `${readmeAuthSectionStartMarker}

## Auth API

When authentication feature is enabled, the generated API exposes:

- POST /auth/register
- POST /auth/login
- GET /auth/me
- POST /auth/refresh-token
- POST /auth/logout

Auth flow notes:

- access token returned in JSON responses
- refresh token stored as httpOnly cookie
- csrf token required for refresh and logout

${readmeAuthSectionEndMarker}`;

const readmeGraphQlSectionBlock = `${readmeGraphQlSectionStartMarker}

## GraphQL API

When API style includes GraphQL, the generated API exposes:

- POST /graphql

Quick check query:

- query: { health version }

${readmeGraphQlSectionEndMarker}`;

const readmeEmailSectionBlock = `${readmeEmailSectionStartMarker}

## Email API

When email feature is enabled, the generated API exposes:

- POST /email/send

Request body:

- to: recipient email
- subject: email subject
- text: plain text body
- html: optional html body

Required environment values for SMTP delivery:

- EMAIL_ENABLED=true
- EMAIL_PROVIDER=smtp
- EMAIL_FROM=no-reply@example.com
- SMTP_HOST=<smtp-host>
- SMTP_PORT=587
- SMTP_SECURE=false
- SMTP_USER=<smtp-user>
- SMTP_PASSWORD=<smtp-password>

${readmeEmailSectionEndMarker}`;

async function disableAuthRoutes(destinationProjectDir) {
  const appCandidates = [path.join(destinationProjectDir, 'src', 'app.js'), path.join(destinationProjectDir, 'src', 'app.ts')];

  for (const appPath of appCandidates) {
    const appStat = await stat(appPath).catch(() => null);

    if (!appStat?.isFile()) {
      continue;
    }

    const appRaw = await readFile(appPath, 'utf8');
    const appUpdated = appRaw
      .replace(/^import \{ authRateLimiter \} from '\.\/middlewares\/rate-limit\.middleware\.js';\r?\n/m, '')
      .replace(/^import \{ authRouter \} from '\.\/modules\/auth\/auth\.routes\.js';\r?\n/m, '')
      .replace(/^\s*if \(\['rest', 'hybrid'\]\.includes\(env\.API_STYLE\)\) \{\r?\n\s*app\.use\('\/auth', authRateLimiter, authRouter\);\r?\n\s*\}\r?\n/m, '')
      .replace(/^\s*app\.use\('\/auth', authRateLimiter, authRouter\);\r?\n/m, '');

    if (appUpdated !== appRaw) {
      await writeFile(appPath, appUpdated, 'utf8');
    }
  }
}

async function removeAuthIntegrationTests(destinationProjectDir) {
  const candidates = [
    path.join(destinationProjectDir, 'tests', 'auth.service.test.js'),
    path.join(destinationProjectDir, 'tests', 'auth.service.test.ts'),
    path.join(destinationProjectDir, 'tests', 'auth.schemas.test.js'),
    path.join(destinationProjectDir, 'tests', 'auth.schemas.test.ts'),
    path.join(destinationProjectDir, 'tests', 'integration', 'auth.http.test.js'),
    path.join(destinationProjectDir, 'tests', 'integration', 'auth.http.test.ts'),
  ];

  for (const testPath of candidates) {
    await rm(testPath, { force: true });
  }
}

async function removeAuthModule(destinationProjectDir) {
  await rm(path.join(destinationProjectDir, 'src', 'modules', 'auth'), {
    recursive: true,
    force: true,
  });
}

async function removeAuthRepository(destinationProjectDir) {
  const candidates = [
    path.join(destinationProjectDir, 'src', 'repositories', 'auth.repository.js'),
    path.join(destinationProjectDir, 'src', 'repositories', 'auth.repository.ts'),
  ];

  for (const repositoryPath of candidates) {
    await rm(repositoryPath, { force: true });
  }
}

async function removeAuthMiddlewares(destinationProjectDir) {
  const candidates = [
    path.join(destinationProjectDir, 'src', 'middlewares', 'auth.middleware.js'),
    path.join(destinationProjectDir, 'src', 'middlewares', 'auth.middleware.ts'),
    path.join(destinationProjectDir, 'src', 'middlewares', 'csrf.middleware.js'),
    path.join(destinationProjectDir, 'src', 'middlewares', 'csrf.middleware.ts'),
    path.join(destinationProjectDir, 'src', 'middlewares', 'rate-limit.middleware.js'),
    path.join(destinationProjectDir, 'src', 'middlewares', 'rate-limit.middleware.ts'),
  ];

  for (const middlewarePath of candidates) {
    await rm(middlewarePath, { force: true });
  }
}

async function removeAuthUtilities(destinationProjectDir) {
  const candidates = [
    path.join(destinationProjectDir, 'src', 'utils', 'crypto.js'),
    path.join(destinationProjectDir, 'src', 'utils', 'crypto.ts'),
  ];

  for (const utilityPath of candidates) {
    await rm(utilityPath, { force: true });
  }
}

async function removeAuthReadmeSection(destinationProjectDir) {
  await updateReadmeAuthSection(destinationProjectDir, false);
}

async function removeDirIfEmpty(dirPath) {
  const dirStat = await stat(dirPath).catch(() => null);

  if (!dirStat?.isDirectory()) {
    return;
  }

  const entries = await readdir(dirPath).catch(() => []);
  if (entries.length === 0) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

async function pruneGeneratedDirectories(destinationProjectDir) {
  await removeDirIfEmpty(path.join(destinationProjectDir, 'src', 'modules'));
  await removeDirIfEmpty(path.join(destinationProjectDir, 'src', 'repositories'));
}

async function appendEmailConfigBlock(destinationProjectDir) {
  const envFiles = ['.env.example', '.env.production.example'];
  const block =
    '\n# Email configuration\nEMAIL_ENABLED=true\nEMAIL_PROVIDER=smtp\nEMAIL_FROM=no-reply@example.com\nSMTP_HOST=\nSMTP_PORT=587\nSMTP_SECURE=false\nSMTP_USER=\nSMTP_PASSWORD=\n';

  for (const envFile of envFiles) {
    const envPath = path.join(destinationProjectDir, envFile);
    const envStat = await stat(envPath).catch(() => null);

    if (!envStat?.isFile()) {
      continue;
    }

    const envRaw = await readFile(envPath, 'utf8');
    if (!envRaw.includes('EMAIL_PROVIDER=')) {
      await writeFile(envPath, `${envRaw.trimEnd()}${block}`, 'utf8');
      continue;
    }

    const envUpdated = envRaw
      .replace(/^EMAIL_ENABLED=.*$/m, 'EMAIL_ENABLED=true')
      .replace(/^EMAIL_PROVIDER=.*$/m, 'EMAIL_PROVIDER=smtp');

    if (envUpdated !== envRaw) {
      await writeFile(envPath, envUpdated, 'utf8');
    }
  }
}

async function disableEmailConfig(destinationProjectDir) {
  const envFiles = ['.env.example', '.env.production.example'];

  for (const envFile of envFiles) {
    const envPath = path.join(destinationProjectDir, envFile);
    const envStat = await stat(envPath).catch(() => null);

    if (!envStat?.isFile()) {
      continue;
    }

    const envRaw = await readFile(envPath, 'utf8');

    if (!envRaw.includes('EMAIL_PROVIDER=')) {
      continue;
    }

    const envUpdated = envRaw
      .replace(/^EMAIL_ENABLED=.*$/m, 'EMAIL_ENABLED=false')
      .replace(/^EMAIL_PROVIDER=.*$/m, 'EMAIL_PROVIDER=none');

    if (envUpdated !== envRaw) {
      await writeFile(envPath, envUpdated, 'utf8');
    }
  }
}

async function configureEmailDependency(destinationProjectDir, emailEnabled) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.dependencies = packageJson.dependencies || {};

  if (emailEnabled) {
    packageJson.dependencies.nodemailer = packageJson.dependencies.nodemailer || '^6.10.1';
  } else {
    delete packageJson.dependencies.nodemailer;
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function disableEmailRoutes(destinationProjectDir) {
  const appCandidates = [path.join(destinationProjectDir, 'src', 'app.js'), path.join(destinationProjectDir, 'src', 'app.ts')];

  for (const appPath of appCandidates) {
    const appStat = await stat(appPath).catch(() => null);

    if (!appStat?.isFile()) {
      continue;
    }

    const appRaw = await readFile(appPath, 'utf8');
    const appUpdated = appRaw
      .replace(/^import \{ emailRouter \} from '\.\/modules\/email\/email\.routes\.js';\r?\n/m, '')
      .replace(/\s*if \(env\.EMAIL_ENABLED\) \{\s*app\.use\('\/email', emailRouter\);\s*\}\s*/gm, '');

    if (appUpdated !== appRaw) {
      await writeFile(appPath, appUpdated, 'utf8');
    }
  }
}

async function removeEmailServiceImportFromAuthService(destinationProjectDir) {
  const authServiceCandidates = [
    path.join(destinationProjectDir, 'src', 'modules', 'auth', 'auth.service.js'),
    path.join(destinationProjectDir, 'src', 'modules', 'auth', 'auth.service.ts'),
  ];

  for (const authServicePath of authServiceCandidates) {
    const authServiceStat = await stat(authServicePath).catch(() => null);

    if (!authServiceStat?.isFile()) {
      continue;
    }

    const authServiceRaw = await readFile(authServicePath, 'utf8');
    let authServiceUpdated = authServiceRaw
      .replace(/^import \{ sendEmail \} from '\.\.\/email\/email\.service\.(?:js|ts)';\r?\n/m, '');

    authServiceUpdated = authServiceUpdated.replace(
      /^(async function issueEmailVerificationToken\(user\) \{)/m,
      '$1\n  if (!env.EMAIL_ENABLED) {\n    return;\n  }',
    );

    authServiceUpdated = authServiceUpdated.replace(
      /\s*await sendEmail\(\{[\s\S]*?\}\);\s*/,
      '',
    );

    if (authServiceUpdated !== authServiceRaw) {
      await writeFile(authServicePath, authServiceUpdated, 'utf8');
    }
  }
}

async function removeEmailModule(destinationProjectDir) {
  await rm(path.join(destinationProjectDir, 'src', 'modules', 'email'), {
    recursive: true,
    force: true,
  });
}

async function removeEmailIntegrationTests(destinationProjectDir) {
  const candidates = [
    path.join(destinationProjectDir, 'tests', 'integration', 'email.http.test.js'),
    path.join(destinationProjectDir, 'tests', 'integration', 'email.http.test.ts'),
    path.join(destinationProjectDir, 'tests', 'integration', 'auth.email-verification.http.test.js'),
    path.join(destinationProjectDir, 'tests', 'integration', 'auth.email-verification.http.test.ts'),
  ];

  for (const testPath of candidates) {
    await rm(testPath, { force: true });
  }
}

function removeGeneratedReadmeSection(readmeContent, startMarker, endMarker) {
  const startIndex = readmeContent.indexOf(startMarker);
  const endIndex = readmeContent.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return readmeContent;
  }

  const afterEndIndex = endIndex + endMarker.length;
  return `${readmeContent.slice(0, startIndex).trimEnd()}\n${readmeContent.slice(afterEndIndex).trimStart()}`;
}

async function updateGeneratedReadmeSection(destinationProjectDir, enabled, block, startMarker, endMarker) {
  const readmePath = path.join(destinationProjectDir, 'README.md');
  const readmeStat = await stat(readmePath).catch(() => null);

  if (!readmeStat?.isFile()) {
    return;
  }

  const readmeRaw = await readFile(readmePath, 'utf8');
  const readmeWithoutGeneratedSection = removeGeneratedReadmeSection(readmeRaw, startMarker, endMarker);

  if (!enabled) {
    if (readmeWithoutGeneratedSection !== readmeRaw) {
      await writeFile(readmePath, `${readmeWithoutGeneratedSection.trimEnd()}\n`, 'utf8');
    }
    return;
  }

  const readmeUpdated = `${readmeWithoutGeneratedSection.trimEnd()}\n\n${block}\n`;
  await writeFile(readmePath, readmeUpdated, 'utf8');
}

async function updateReadmeEmailSection(destinationProjectDir, emailEnabled) {
  await updateGeneratedReadmeSection(
    destinationProjectDir,
    emailEnabled,
    readmeEmailSectionBlock,
    readmeEmailSectionStartMarker,
    readmeEmailSectionEndMarker,
  );
}

async function updateReadmeAuthSection(destinationProjectDir, authEnabled) {
  await updateGeneratedReadmeSection(
    destinationProjectDir,
    authEnabled,
    readmeAuthSectionBlock,
    readmeAuthSectionStartMarker,
    readmeAuthSectionEndMarker,
  );
}

async function updateReadmeGraphQlSection(destinationProjectDir, graphQlEnabled) {
  await updateGeneratedReadmeSection(
    destinationProjectDir,
    graphQlEnabled,
    readmeGraphQlSectionBlock,
    readmeGraphQlSectionStartMarker,
    readmeGraphQlSectionEndMarker,
  );
}

async function configureEmailOpenApiPath(destinationProjectDir, emailEnabled) {
  const openApiCandidates = [
    path.join(destinationProjectDir, 'src', 'docs', 'openapi.js'),
    path.join(destinationProjectDir, 'src', 'docs', 'openapi.ts'),
  ];

  let openApiPath = '';
  for (const candidate of openApiCandidates) {
    const openApiStat = await stat(candidate).catch(() => null);

    if (openApiStat?.isFile()) {
      openApiPath = candidate;
      break;
    }
  }

  if (!openApiPath) {
    return;
  }

  const openApiRaw = await readFile(openApiPath, 'utf8');
  let openApiUpdated = openApiRaw;

  if (emailEnabled) {
    if (!openApiUpdated.includes("'/email/send'")) {
      openApiUpdated = openApiUpdated.replace('\n  },\n};', `${emailOpenApiPathBlock}\n  },\n};`);
    }
  } else if (openApiUpdated.includes("'/email/send'")) {
    openApiUpdated = openApiUpdated.replace(emailOpenApiPathBlock, '');
  }

  if (openApiUpdated !== openApiRaw) {
    await writeFile(openApiPath, openApiUpdated, 'utf8');
  }
}

async function updateReadmeFeatureSection(destinationProjectDir, featureSet) {
  const readmePath = path.join(destinationProjectDir, 'README.md');
  const readmeStat = await stat(readmePath).catch(() => null);

  if (!readmeStat?.isFile()) {
    return;
  }

  const authEnabled = hasAuthFeature(featureSet);
  const emailEnabled = hasEmailFeature(featureSet);
  const readmeRaw = await readFile(readmePath, 'utf8');

  const featureLines = [
    'Generated feature set:',
    `- authentication: ${authEnabled ? 'enabled' : 'disabled'}`,
    `- email config: ${emailEnabled ? 'enabled' : 'disabled'}`,
  ];

  const readmeUpdated = `${readmeRaw.trimEnd()}\n\n${featureLines.join('\n')}\n`;
  await writeFile(readmePath, readmeUpdated, 'utf8');
}

export async function configureGeneratedFeatures(destinationProjectDir, featureSet, apiStyle = 'rest') {
  const authEnabled = hasAuthFeature(featureSet);
  const emailEnabled = hasEmailFeature(featureSet);
  const graphQlEnabled = apiStyle === 'graphql' || apiStyle === 'hybrid';

  if (!authEnabled) {
    await disableAuthRoutes(destinationProjectDir);
    await removeAuthIntegrationTests(destinationProjectDir);
    await removeAuthModule(destinationProjectDir);
    await removeAuthRepository(destinationProjectDir);
    await removeAuthMiddlewares(destinationProjectDir);
    await removeAuthUtilities(destinationProjectDir);
    await removeAuthReadmeSection(destinationProjectDir);
  }

  if (emailEnabled) {
    await appendEmailConfigBlock(destinationProjectDir);
  } else {
    await disableEmailConfig(destinationProjectDir);
    await disableEmailRoutes(destinationProjectDir);
    await removeEmailModule(destinationProjectDir);
    await removeEmailIntegrationTests(destinationProjectDir);
  }

  await configureEmailDependency(destinationProjectDir, emailEnabled);
  await configureEmailOpenApiPath(destinationProjectDir, emailEnabled);

  if (!emailEnabled) {
    await removeEmailServiceImportFromAuthService(destinationProjectDir);
  }

  await updateReadmeAuthSection(destinationProjectDir, authEnabled);
  await updateReadmeGraphQlSection(destinationProjectDir, graphQlEnabled);
  await updateReadmeEmailSection(destinationProjectDir, emailEnabled);
  await pruneGeneratedDirectories(destinationProjectDir);

  await updateReadmeFeatureSection(destinationProjectDir, featureSet);
}