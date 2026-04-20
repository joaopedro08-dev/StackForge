import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readFile, rm, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const currentFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(currentFilePath);
const rootDir = path.resolve(testsDir, '..', '..');
const generatorPath = path.join(rootDir, 'scripts', 'new-auth-project.mjs');
const projectsRootDir = path.join(rootDir, 'developers', 'projects');

const authMarker = '<!-- generated-auth-api:start -->';
const graphQlMarker = '<!-- generated-graphql-api:start -->';
const emailMarker = '<!-- generated-email-api:start -->';

function buildProjectName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function generateProjectReadme(prefix, args) {
  const projectName = buildProjectName(prefix);
  const projectDir = path.join(projectsRootDir, projectName);

  try {
    await execFileAsync(process.execPath, [generatorPath, '--', projectName, ...args], {
      cwd: rootDir,
      env: process.env,
    });

    return await readFile(path.join(projectDir, 'README.md'), 'utf8');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

async function generateProjectPackageJson(prefix, args) {
  const projectName = buildProjectName(prefix);
  const projectDir = path.join(projectsRootDir, projectName);

  try {
    await execFileAsync(process.execPath, [generatorPath, '--', projectName, ...args], {
      cwd: rootDir,
      env: process.env,
    });

    const packageJsonRaw = await readFile(path.join(projectDir, 'package.json'), 'utf8');
    return {
      projectName,
      packageJson: JSON.parse(packageJsonRaw),
    };
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

describe('new-auth-project README conditional sections', () => {
  it('includes only auth section for features=auth and api=rest', async () => {
    const readme = await generateProjectReadme('readme-auth-rest', [
      '--features=auth',
      '--api=rest',
      '--profile=lite',
      '--db=json',
      '--lang=javascript',
    ]);

    expect(readme.includes(authMarker)).toBe(true);
    expect(readme.includes(graphQlMarker)).toBe(false);
    expect(readme.includes(emailMarker)).toBe(false);
  });

  it('includes auth, graphql and email sections for features=both and api=hybrid', async () => {
    const readme = await generateProjectReadme('readme-both-hybrid', [
      '--features=both',
      '--api=hybrid',
      '--profile=lite',
      '--db=json',
      '--lang=javascript',
    ]);

    expect(readme.includes(authMarker)).toBe(true);
    expect(readme.includes(graphQlMarker)).toBe(true);
    expect(readme.includes(emailMarker)).toBe(true);
  });

  it('includes no generated API sections for features=none and api=rest', async () => {
    const readme = await generateProjectReadme('readme-none-rest', [
      '--features=none',
      '--api=rest',
      '--profile=lite',
      '--db=json',
      '--lang=javascript',
    ]);

    expect(readme.includes(authMarker)).toBe(false);
    expect(readme.includes(graphQlMarker)).toBe(false);
    expect(readme.includes(emailMarker)).toBe(false);
  });

  it('adds dynamic summary with selected options and package-manager command', async () => {
    const readme = await generateProjectReadme('readme-summary-ts-graphql', [
      '--features=both',
      '--api=graphql',
      '--profile=full',
      '--db=postgresql',
      '--architecture=clean',
      '--lang=typescript',
      '--pm=npm',
    ]);

    expect(readme.includes('<!-- generated-project-summary:start -->')).toBe(true);
    expect(readme.includes('- profile: full')).toBe(true);
    expect(readme.includes('- language: typescript')).toBe(true);
    expect(readme.includes('- database: postgresql')).toBe(true);
    expect(readme.includes('- architecture: clean')).toBe(true);
    expect(readme.includes('- api style: graphql')).toBe(true);
    expect(readme.includes('- package manager: npm')).toBe(true);
    expect(readme.includes('- feature set: both')).toBe(true);
    expect(readme.includes('npm install')).toBe(true);
    expect(readme.includes('npm run dev')).toBe(true);
    expect(readme.includes('GraphQL endpoint: /graphql')).toBe(true);
    expect(readme.includes('Email endpoint: /email/send')).toBe(true);
  }, 20_000);

  it('removes auth and email routes for features=none in typescript projects', async () => {
    const projectName = buildProjectName('readme-none-ts-routes');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--lang=typescript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const appTs = await readFile(path.join(projectDir, 'src', 'app.ts'), 'utf8');
      expect(appTs.includes("app.use('/auth', authRateLimiter, authRouter);")).toBe(false);
      expect(appTs.includes("app.use('/email', emailRouter);")).toBe(false);
      expect(appTs.includes('});app.use(notFoundHandler);')).toBe(false);
      expect(appTs.includes('\n\n  app.use(notFoundHandler);')).toBe(true);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('does not keep auth module artifacts for features=none with mvc', async () => {
    const projectName = buildProjectName('readme-none-mvc-structure');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--architecture=mvc', '--lang=javascript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const authModuleStat = await stat(path.join(projectDir, 'src', 'modules', 'auth')).catch(() => null);
      const authRepositoryStat = await stat(path.join(projectDir, 'src', 'repositories', 'auth.repository.js')).catch(() => null);
      const authMiddlewareStat = await stat(path.join(projectDir, 'src', 'middlewares', 'auth.middleware.js')).catch(() => null);

      expect(authModuleStat).toBeNull();
      expect(authRepositoryStat).toBeNull();
      expect(authMiddlewareStat).toBeNull();

      const middlewaresDirStat = await stat(path.join(projectDir, 'src', 'middlewares')).catch(() => null);
      const utilsDirStat = await stat(path.join(projectDir, 'src', 'utils')).catch(() => null);
      const docsDirStat = await stat(path.join(projectDir, 'src', 'docs')).catch(() => null);
      const routesDirStat = await stat(path.join(projectDir, 'src', 'routes')).catch(() => null);
      const modulesDirStat = await stat(path.join(projectDir, 'src', 'modules')).catch(() => null);
      const controllersDirStat = await stat(path.join(projectDir, 'src', 'controllers')).catch(() => null);
      const configDirStat = await stat(path.join(projectDir, 'src', 'config')).catch(() => null);
      const openApiInConfigStat = await stat(path.join(projectDir, 'src', 'config', 'openapi.js')).catch(() => null);

      expect(middlewaresDirStat?.isDirectory()).toBe(true);
      expect(utilsDirStat?.isDirectory()).toBe(true);
      expect(docsDirStat).toBeNull();
      expect(routesDirStat?.isDirectory()).toBe(true);
      expect(modulesDirStat).toBeNull();
      expect(controllersDirStat?.isDirectory()).toBe(true);
      expect(configDirStat?.isDirectory()).toBe(true);
      expect(openApiInConfigStat?.isFile()).toBe(true);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it('keeps only mvc target folders for features=none', async () => {
    const projectName = buildProjectName('mvc-none-folder-contract');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--architecture=mvc', '--lang=javascript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const expectedFolders = ['config', 'controllers', 'db', 'middlewares', 'models', 'routes', 'utils', 'views'];
      for (const folderName of expectedFolders) {
        const folderStat = await stat(path.join(projectDir, 'src', folderName)).catch(() => null);
        expect(folderStat?.isDirectory()).toBe(true);
      }

      const forbiddenFolders = ['modules', 'docs'];
      for (const folderName of forbiddenFolders) {
        const folderStat = await stat(path.join(projectDir, 'src', folderName)).catch(() => null);
        expect(folderStat).toBeNull();
      }
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('keeps layered example files distributed across layers for features=none', async () => {
    const projectName = buildProjectName('layered-none-example-distribution');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--architecture=layered', '--lang=typescript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const expectedFiles = [
        'src/modules/example/example.controller.example.ts',
        'src/modules/example/example.service.example.ts',
        'src/repositories/example.repository.example.ts',
        'src/middlewares/example.middleware.example.ts',
        'src/utils/example.util.example.ts',
      ];

      for (const relativeFilePath of expectedFiles) {
        const fileStat = await stat(path.join(projectDir, relativeFilePath)).catch(() => null);
        expect(fileStat?.isFile()).toBe(true);
      }

      const layeredModulesDirStat = await stat(path.join(projectDir, 'src', 'modules')).catch(() => null);
      expect(layeredModulesDirStat?.isDirectory()).toBe(true);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('keeps clean example files distributed across layers for features=none', async () => {
    const projectName = buildProjectName('clean-none-example-distribution');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--architecture=clean', '--lang=typescript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const controllerRaw = await readFile(path.join(projectDir, 'src', 'interfaces', 'http', 'auth.controller.example.ts'), 'utf8');
      const useCaseRaw = await readFile(path.join(projectDir, 'src', 'application', 'register-user.use-case.example.ts'), 'utf8');
      const repositoryRaw = await readFile(path.join(projectDir, 'src', 'infrastructure', 'user.repository.example.ts'), 'utf8');
      const domainRaw = await readFile(path.join(projectDir, 'src', 'domain', 'user.entity.example.ts'), 'utf8');

      expect(domainRaw.includes('export type UserEntityInput')).toBe(true);
      expect(domainRaw.includes('export type UserEntity')).toBe(true);
      expect(useCaseRaw.includes("import { createUserEntity } from '../domain/user.entity.example';")).toBe(true);
      expect(useCaseRaw.includes("import type { UserEntity } from '../domain/user.entity.example';")).toBe(true);
      expect(repositoryRaw.includes("import type { UserEntity } from '../domain/user.entity.example';")).toBe(true);
      expect(controllerRaw.includes("import { registerUserUseCase } from '../../application/register-user.use-case.example';")).toBe(true);
      expect(controllerRaw.includes("import type { UserEntity } from '../../domain/user.entity.example';")).toBe(true);
      expect(controllerRaw.includes('registerUserUseCase(req.body, dependencies)')).toBe(true);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 20_000);
});

describe('new-auth-project package.json conditional filtering', () => {
  it('keeps only json/rest/none dependencies and removes internal scripts', async () => {
    const { projectName, packageJson } = await generateProjectPackageJson('pkg-none-json-rest', [
      '--features=none',
      '--db=json',
      '--api=rest',
      '--lang=javascript',
      '--profile=lite',
    ]);

    expect(packageJson.dependencies.lowdb).toBeDefined();
    expect(packageJson.dependencies.bcryptjs).toBeUndefined();
    expect(packageJson.dependencies['cookie-parser']).toBeUndefined();
    expect(packageJson.dependencies.jsonwebtoken).toBeUndefined();
    expect(packageJson.dependencies['express-rate-limit']).toBeUndefined();
    expect(packageJson.dependencies['@prisma/client']).toBeUndefined();
    expect(packageJson.dependencies.prisma).toBeUndefined();
    expect(packageJson.dependencies.nodemailer).toBeUndefined();
    expect(packageJson.dependencies.graphql).toBeUndefined();
    expect(packageJson.dependencies['@apollo/server']).toBeUndefined();
    expect(packageJson.dependencies['@as-integrations/express5']).toBeUndefined();
    expect(packageJson.dependencies.archiver).toBeUndefined();

    expect(packageJson.scripts['prisma:generate']).toBeUndefined();
    expect(packageJson.scripts['prisma:migrate']).toBeUndefined();
    expect(packageJson.scripts['prisma:deploy']).toBeUndefined();
    expect(packageJson.scripts['prisma:push']).toBeUndefined();
    expect(packageJson.scripts['prisma:bootstrap']).toBeUndefined();
    expect(packageJson.scripts['test:scaffold:readme']).toBeUndefined();
    expect(packageJson.scripts['test:scaffold:arch-api']).toBeUndefined();
    expect(packageJson.scripts['test:scaffold:full-runtime']).toBeUndefined();

    expect(packageJson.description).toContain(projectName);
    expect(packageJson.description).toContain('rest');
    expect(packageJson.description).toContain('json');
    expect(packageJson.keywords).toContain('rest');
    expect(packageJson.keywords).toContain('json');
    expect(packageJson.keywords).toContain('lowdb');
    expect(packageJson.keywords.some((keyword) => /\d/.test(keyword))).toBe(false);
  }, 20_000);

  it('keeps auth dependencies and auth-related types only when auth is enabled', async () => {
    const { packageJson } = await generateProjectPackageJson('pkg-auth-json-ts', [
      '--features=auth',
      '--db=json',
      '--api=rest',
      '--lang=typescript',
      '--profile=lite',
    ]);

    expect(packageJson.dependencies.bcryptjs).toBeDefined();
    expect(packageJson.dependencies['cookie-parser']).toBeDefined();
    expect(packageJson.dependencies.jsonwebtoken).toBeDefined();
    expect(packageJson.dependencies['express-rate-limit']).toBeDefined();
    expect(packageJson.devDependencies['@types/cookie-parser']).toBeDefined();
    expect(packageJson.devDependencies['@types/jsonwebtoken']).toBeDefined();

    expect(packageJson.dependencies.lowdb).toBeDefined();
    expect(packageJson.dependencies['@prisma/client']).toBeUndefined();
    expect(packageJson.dependencies.prisma).toBeUndefined();
    expect(packageJson.dependencies.nodemailer).toBeUndefined();
    expect(packageJson.dependencies.graphql).toBeUndefined();
  }, 20_000);

  it('keeps prisma, email and graphql dependencies only when selected', async () => {
    const { packageJson } = await generateProjectPackageJson('pkg-both-postgres-hybrid', [
      '--features=both',
      '--db=postgresql',
      '--api=hybrid',
      '--lang=typescript',
      '--profile=lite',
    ]);

    expect(packageJson.dependencies.lowdb).toBeUndefined();
    expect(packageJson.dependencies['@prisma/client']).toBeDefined();
    expect(packageJson.dependencies.prisma).toBeDefined();
    expect(packageJson.dependencies.nodemailer).toBeDefined();
    expect(packageJson.dependencies.graphql).toBeDefined();
    expect(packageJson.dependencies['@apollo/server']).toBeDefined();
    expect(packageJson.dependencies['@as-integrations/express5']).toBeDefined();
    expect(packageJson.dependencies.archiver).toBeUndefined();

    expect(packageJson.scripts['prisma:generate']).toBeDefined();
    expect(packageJson.scripts['prisma:migrate']).toBeDefined();
    expect(packageJson.scripts['prisma:deploy']).toBeDefined();
    expect(packageJson.scripts['prisma:push']).toBeDefined();
    expect(packageJson.scripts['prisma:bootstrap']).toBeDefined();

    expect(packageJson.scripts['test:scaffold:readme']).toBeUndefined();
    expect(packageJson.scripts['test:scaffold:arch-api']).toBeUndefined();
    expect(packageJson.scripts['test:scaffold:full-runtime']).toBeUndefined();
  }, 20_000);

  it('removes prisma schema for json database projects', async () => {
    const projectName = buildProjectName('pkg-json-schema-removal');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--db=json', '--api=rest', '--architecture=layered', '--lang=javascript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const schemaStat = await stat(path.join(projectDir, 'prisma', 'schema.prisma')).catch(() => null);
      const prismaDirStat = await stat(path.join(projectDir, 'prisma')).catch(() => null);

      expect(schemaStat).toBeNull();
      expect(prismaDirStat).toBeNull();
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('keeps prisma schema provider aligned with relational database providers', async () => {
    const projectName = buildProjectName('pkg-mysql-schema-provider');
    const projectDir = path.join(projectsRootDir, projectName);

    try {
      await execFileAsync(process.execPath, [generatorPath, '--', projectName, '--features=none', '--db=mysql', '--api=rest', '--architecture=layered', '--lang=javascript', '--profile=lite'], {
        cwd: rootDir,
        env: process.env,
      });

      const schemaRaw = await readFile(path.join(projectDir, 'prisma', 'schema.prisma'), 'utf8');
      expect(schemaRaw.includes('provider = "mysql"')).toBe(true);
      expect(schemaRaw.includes('provider = "postgresql"')).toBe(false);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 20_000);
});
