import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const consoleApi = globalThis.console;

if (!consoleApi) {
  throw new Error('Console API is not available in the current Node.js runtime.');
}

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

export const scriptsDir = path.resolve(currentDir, '..');
export const rootDir = path.resolve(scriptsDir, '..');
export const projectsRootDir = path.join(rootDir, 'developers', 'projects');

export const supportedDatabases = ['json', 'postgresql', 'mysql', 'sqlite', 'sqlserver'];
export const supportedArchitectures = ['layered', 'mvc', 'clean'];
export const supportedApiStyles = ['rest', 'graphql', 'hybrid'];
export const supportedPackageManagers = ['pnpm', 'npm', 'yarn', 'bun'];
export const supportedFeatureSets = ['auth', 'email', 'both', 'none'];

export const topLevelPathsToCopyByProfile = {
  lite: [
    '.dockerignore',
    '.env.example',
    '.env.production.example',
    '.gitignore',
    'Dockerfile',
    'README.md',
    'docker-compose.production.yml',
    'eslint.config.js',
    'index.js',
    'package.json',
    'pnpm-lock.yaml',
    'prisma',
    'src',
    'vitest.config.mjs',
    'vitest.workspace.mjs',
  ],
  full: [
    '.dockerignore',
    '.env.example',
    '.env.production.example',
    '.github',
    '.gitignore',
    'Dockerfile',
    'README.md',
    'docker-compose.production.yml',
    'docs',
    'eslint.config.js',
    'index.js',
    'package.json',
    'pnpm-lock.yaml',
    'prisma',
    'src',
    'tests',
    'vitest.config.mjs',
    'vitest.workspace.mjs',
  ],
};

export const nestedIgnorePaths = new Set([
  path.normalize('scripts/new-auth-project.mjs'),
  path.normalize('developers'),
  path.normalize('node_modules'),
  path.normalize('.git'),
  path.normalize('data'),
  path.normalize('tests/downloads-manager.test.js'),
  path.normalize('tests/openapi.test.js'),
  path.normalize('tests/scripts'),
]);
