import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { configureGeneratedPackageManager } from '../../scripts/new-auth-project/package-manager.mjs';

function buildPackageJsonFixture() {
  return {
    name: 'fixture-api',
    version: '1.0.0',
    scripts: {
      dev: 'nodemon index.js',
      start: 'node index.js',
      'prisma:push': 'prisma db push --skip-generate',
      'prisma:bootstrap': 'pnpm prisma:push',
      audit: 'pnpm audit --audit-level=high',
    },
  };
}

const dockerfileFixture = `FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prune --prod
CMD ["sh", "-c", "pnpm prisma:bootstrap && pnpm start"]
`;

const readmeFixture = `# Example\n\n\`\`\`bash\npnpm install\npnpm run dev\n\`\`\`\n`;

describe('configureGeneratedPackageManager', () => {
  it('converts scripts and files for yarn', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'stackforge-pm-yarn-'));

    try {
      await mkdir(tempRoot, { recursive: true });
      await writeFile(path.join(tempRoot, 'package.json'), `${JSON.stringify(buildPackageJsonFixture(), null, 2)}\n`, 'utf8');
      await writeFile(path.join(tempRoot, 'Dockerfile'), dockerfileFixture, 'utf8');
      await writeFile(path.join(tempRoot, 'README.md'), readmeFixture, 'utf8');
      await writeFile(path.join(tempRoot, 'pnpm-lock.yaml'), 'lockfile', 'utf8');

      await configureGeneratedPackageManager(tempRoot, 'yarn');

      const packageJson = JSON.parse(await readFile(path.join(tempRoot, 'package.json'), 'utf8'));
      const dockerfile = await readFile(path.join(tempRoot, 'Dockerfile'), 'utf8');
      const readme = await readFile(path.join(tempRoot, 'README.md'), 'utf8');

      expect(packageJson.packageManager).toBe('yarn@1.22.22');
      expect(packageJson.scripts['prisma:bootstrap']).toBe('yarn prisma:push');
      expect(packageJson.scripts.audit).toBe('yarn audit');
      expect(dockerfile.includes('RUN yarn install')).toBe(true);
      expect(dockerfile.includes('yarn prisma:bootstrap && yarn start')).toBe(true);
      expect(readme.includes('yarn install')).toBe(true);
      await expect(readFile(path.join(tempRoot, 'pnpm-lock.yaml'), 'utf8')).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('converts scripts and files for bun', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'stackforge-pm-bun-'));

    try {
      await mkdir(tempRoot, { recursive: true });
      await writeFile(path.join(tempRoot, 'package.json'), `${JSON.stringify(buildPackageJsonFixture(), null, 2)}\n`, 'utf8');
      await writeFile(path.join(tempRoot, 'Dockerfile'), dockerfileFixture, 'utf8');
      await writeFile(path.join(tempRoot, 'README.md'), readmeFixture, 'utf8');
      await writeFile(path.join(tempRoot, 'pnpm-lock.yaml'), 'lockfile', 'utf8');

      await configureGeneratedPackageManager(tempRoot, 'bun');

      const packageJson = JSON.parse(await readFile(path.join(tempRoot, 'package.json'), 'utf8'));
      const dockerfile = await readFile(path.join(tempRoot, 'Dockerfile'), 'utf8');
      const readme = await readFile(path.join(tempRoot, 'README.md'), 'utf8');

      expect(packageJson.packageManager).toBe('bun@1.1.38');
      expect(packageJson.scripts['prisma:bootstrap']).toBe('bun run prisma:push');
      expect(packageJson.scripts.audit).toBe('bun audit');
      expect(dockerfile.includes('RUN bun install')).toBe(true);
      expect(dockerfile.includes('bun run prisma:bootstrap && bun run start')).toBe(true);
      expect(readme.includes('bun install')).toBe(true);
      await expect(readFile(path.join(tempRoot, 'pnpm-lock.yaml'), 'utf8')).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
