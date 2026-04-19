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
  });

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
  });
});
