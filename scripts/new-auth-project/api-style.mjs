import path from 'node:path';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { removeFileIfExists } from './filesystem.mjs';

function getGraphQLServerContent() {
  return `import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';

const typeDefs = \`#graphql
  type Query {
    health: String!
    version: String!
  }
\`;

const resolvers = {
  Query: {
    health: () => 'ok',
    version: () => '1.0.0',
  },
};

export async function mountGraphQLApi(app) {
  const graphqlServer = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await graphqlServer.start();
  app.use('/graphql', expressMiddleware(graphqlServer));
}
`;
}

function getGraphQLIntegrationTestContent() {
  return `import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { resetTestDatabase } from '../helpers/auth-test-utils.js';

describe('graphql http flow', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('returns readiness status with database check', async () => {
    const response = await request(app).get('/health/readiness');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database.ok).toBe(true);
  });

  it('serves OpenAPI specification with graphql route', async () => {
    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.paths['/graphql']).toBeDefined();
  });

  it('executes basic graphql query', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ health version }' });

    expect(response.status).toBe(200);
    expect(response.body.data.health).toBe('ok');
    expect(response.body.data.version).toBe('1.0.0');
  });
});
`;
}

function getOpenApiDocumentContent(apiStyle) {
  const includeRestAuthPaths = apiStyle === 'rest' || apiStyle === 'hybrid';
  const includeGraphQLPath = apiStyle === 'graphql' || apiStyle === 'hybrid';

  const authPaths = includeRestAuthPaths
    ? `,
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          409: {
            description: 'Email already in use',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Authenticated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          429: {
            description: 'Too many failed login attempts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Authenticated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MeResponse' },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        summary: 'Refresh access token',
        parameters: [
          {
            in: 'header',
            name: 'x-csrf-token',
            required: true,
            schema: { type: 'string' },
            description: 'CSRF token returned by register/login/refresh',
          },
        ],
        responses: {
          200: {
            description: 'Refreshed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'Invalid refresh token or session',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          403: {
            description: 'CSRF token invalid or missing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout current session',
        parameters: [
          {
            in: 'header',
            name: 'x-csrf-token',
            required: true,
            schema: { type: 'string' },
            description: 'CSRF token returned by register/login/refresh',
          },
        ],
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                  required: ['message'],
                },
              },
            },
          },
          401: {
            description: 'Invalid session',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          403: {
            description: 'CSRF token invalid or missing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    }`
    : '';

  const graphQLPath = includeGraphQLPath
    ? `,
    '/graphql': {
      post: {
        summary: 'GraphQL endpoint',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  variables: { type: 'object' },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'GraphQL response payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
        },
      },
    }`
    : '';

  const descriptionByStyle = {
    rest: 'StackForge REST API.',
    graphql: 'StackForge GraphQL API.',
    hybrid: 'StackForge hybrid API (REST + GraphQL).',
  };

  return `export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'StackForge API',
    version: '1.0.0',
    description: '${descriptionByStyle[apiStyle]}',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'email', 'createdAt'],
      },
      RegisterRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          confirmPassword: { type: 'string' },
        },
        required: ['name', 'email', 'password', 'confirmPassword'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          csrfToken: { type: 'string' },
        },
        required: ['user', 'accessToken', 'csrfToken'],
      },
      MeResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
        },
        required: ['user'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  provider: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['ok', 'provider'],
              },
            },
            required: ['database'],
          },
        },
        required: ['status', 'checks'],
      },
    },
  },
  paths: {
    '/health/liveness': {
      get: {
        summary: 'Liveness health check',
        responses: {
          200: {
            description: 'Service is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                  },
                  required: ['status'],
                },
              },
            },
          },
        },
      },
    },
    '/health/readiness': {
      get: {
        summary: 'Readiness health check',
        responses: {
          200: {
            description: 'Dependencies are ready',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          503: {
            description: 'Dependencies are not ready',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    }${authPaths}${graphQLPath}
  },
};
`;
}

async function updateGeneratedOpenApiByApiStyle(destinationProjectDir, apiStyle) {
  const openApiPath = path.join(destinationProjectDir, 'src', 'docs', 'openapi.js');
  const openApiStat = await stat(openApiPath).catch(() => null);

  if (!openApiStat?.isFile()) {
    return;
  }

  await writeFile(openApiPath, getOpenApiDocumentContent(apiStyle), 'utf8');
}

async function updateGeneratedTestsByApiStyle(destinationProjectDir, apiStyle) {
  const integrationTestsDir = path.join(destinationProjectDir, 'tests', 'integration');
  const integrationTestsStat = await stat(integrationTestsDir).catch(() => null);

  if (!integrationTestsStat?.isDirectory()) {
    return;
  }

  const authHttpTestPath = path.join(integrationTestsDir, 'auth.http.test.js');
  const graphQlHttpTestPath = path.join(integrationTestsDir, 'graphql.http.test.js');

  if (apiStyle === 'graphql') {
    await removeFileIfExists(authHttpTestPath);
    await writeFile(graphQlHttpTestPath, getGraphQLIntegrationTestContent(), 'utf8');
    return;
  }

  if (apiStyle === 'hybrid') {
    await writeFile(graphQlHttpTestPath, getGraphQLIntegrationTestContent(), 'utf8');
    return;
  }

  await removeFileIfExists(graphQlHttpTestPath);
}

async function updateGeneratedEnvApiStyle(destinationProjectDir, apiStyle) {
  const envFiles = ['.env.example', '.env.production.example'];

  for (const fileName of envFiles) {
    const envPath = path.join(destinationProjectDir, fileName);
    const envStat = await stat(envPath).catch(() => null);

    if (!envStat?.isFile()) {
      continue;
    }

    const envRaw = await readFile(envPath, 'utf8');
    let envUpdated = envRaw;

    if (envUpdated.includes('API_STYLE=')) {
      envUpdated = envUpdated.replace(/^API_STYLE=.*$/m, `API_STYLE=${apiStyle}`);
    } else {
      envUpdated = envUpdated.replace(/^PORT=.*$/m, (matchedLine) => `${matchedLine}\nAPI_STYLE=${apiStyle}`);
    }

    if (envUpdated !== envRaw) {
      await writeFile(envPath, envUpdated, 'utf8');
    }
  }
}

async function updateGeneratedPackageJsonApiStyle(destinationProjectDir, apiStyle) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.dependencies = packageJson.dependencies || {};

  if (apiStyle === 'graphql' || apiStyle === 'hybrid') {
    packageJson.dependencies.graphql = packageJson.dependencies.graphql || '^16.11.0';
    packageJson.dependencies['@apollo/server'] = packageJson.dependencies['@apollo/server'] || '^4.12.2';
    packageJson.dependencies['@as-integrations/express5'] = packageJson.dependencies['@as-integrations/express5'] || '^1.1.2';
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function updateGeneratedRuntimeApiStyle(destinationProjectDir, apiStyle) {
  const appPath = path.join(destinationProjectDir, 'src', 'app.js');
  const envConfigPath = path.join(destinationProjectDir, 'src', 'config', 'env.js');

  const appStat = await stat(appPath).catch(() => null);
  if (appStat?.isFile()) {
    const appRaw = await readFile(appPath, 'utf8');
    let appUpdated = appRaw;
    const needsGraphQLRuntime = apiStyle === 'graphql' || apiStyle === 'hybrid';

    if (needsGraphQLRuntime && !appUpdated.includes('mountGraphQLIfEnabled')) {
      appUpdated = appUpdated.replace(
        "import { authRouter } from './modules/auth/auth.routes.js';",
        "import { authRouter } from './modules/auth/auth.routes.js';\n\nasync function mountGraphQLIfEnabled(appInstance) {\n  if (!['graphql', 'hybrid'].includes(env.API_STYLE)) {\n    return;\n  }\n\n  const { mountGraphQLApi } = await import('./graphql/server.js');\n  await mountGraphQLApi(appInstance);\n}\n",
      );
    }

    if (needsGraphQLRuntime) {
      appUpdated = appUpdated.replace(
        "app.use('/auth', authRateLimiter, authRouter);",
        "if (['rest', 'hybrid'].includes(env.API_STYLE)) {\n  app.use('/auth', authRateLimiter, authRouter);\n}\n\nvoid mountGraphQLIfEnabled(app);",
      );
    } else {
      appUpdated = appUpdated
        .replace(
          /\nasync function mountGraphQLIfEnabled\(appInstance\) \{[\s\S]*?\n\}\n\n/m,
          '\n',
        )
        .replace(
          "if (['rest', 'hybrid'].includes(env.API_STYLE)) {\n  app.use('/auth', authRateLimiter, authRouter);\n}\n\nvoid mountGraphQLIfEnabled(app);",
          "app.use('/auth', authRateLimiter, authRouter);",
        );
    }

    if (appUpdated !== appRaw) {
      await writeFile(appPath, appUpdated, 'utf8');
    }
  }

  const envStat = await stat(envConfigPath).catch(() => null);
  if (envStat?.isFile()) {
    const envRaw = await readFile(envConfigPath, 'utf8');
    let envUpdated = envRaw;

    if (!envUpdated.includes('API_STYLE:')) {
      envUpdated = envUpdated.replace(
        "  PORT: z.coerce.number().int().positive().default(3000),",
        `  PORT: z.coerce.number().int().positive().default(3000),\n  API_STYLE: z.enum(['rest', 'graphql', 'hybrid']).default('${apiStyle}'),`,
      );
    } else {
      envUpdated = envUpdated.replace(
        /API_STYLE:\s*z\.enum\(\['rest', 'graphql', 'hybrid'\]\)\.default\('[^']+'\),/,
        `API_STYLE: z.enum(['rest', 'graphql', 'hybrid']).default('${apiStyle}'),`,
      );
    }

    if (envUpdated !== envRaw) {
      await writeFile(envConfigPath, envUpdated, 'utf8');
    }
  }
}

async function writeGeneratedGraphQLFiles(destinationProjectDir, apiStyle) {
  if (apiStyle !== 'graphql' && apiStyle !== 'hybrid') {
    return;
  }

  const graphQLDirPath = path.join(destinationProjectDir, 'src', 'graphql');
  await mkdir(graphQLDirPath, { recursive: true });
  await writeFile(path.join(graphQLDirPath, 'server.js'), getGraphQLServerContent(), 'utf8');
}

export async function configureGeneratedApiStyle(destinationProjectDir, apiStyle) {
  await updateGeneratedEnvApiStyle(destinationProjectDir, apiStyle);
  await updateGeneratedPackageJsonApiStyle(destinationProjectDir, apiStyle);
  await updateGeneratedRuntimeApiStyle(destinationProjectDir, apiStyle);
  await updateGeneratedOpenApiByApiStyle(destinationProjectDir, apiStyle);
  await updateGeneratedTestsByApiStyle(destinationProjectDir, apiStyle);
  await writeGeneratedGraphQLFiles(destinationProjectDir, apiStyle);
}
