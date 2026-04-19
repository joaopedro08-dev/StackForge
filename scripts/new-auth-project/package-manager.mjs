import path from 'node:path';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';

const scriptCommandPattern = /(^|[;&|]\s*)pnpm\s+([a-zA-Z0-9:_-]+)([^&|;\n]*)/g;

function buildPackageManagerValue(packageManager) {
  if (packageManager === 'npm') {
    return 'npm@10';
  }

  if (packageManager === 'yarn') {
    return 'yarn@1.22.22';
  }

  if (packageManager === 'bun') {
    return 'bun@1.1.38';
  }

  return 'pnpm@10.33.0';
}

function convertPnpmCalls(scriptValue, packageManager) {
  return scriptValue.replace(scriptCommandPattern, (_match, prefix, commandName, suffix) => {
    const trimmedSuffix = suffix ?? '';
    const commandPrefix = prefix ?? '';

    if (packageManager === 'npm') {
      if (commandName.includes(':')) {
        return `${commandPrefix}npm run ${commandName}${trimmedSuffix}`;
      }

      return `${commandPrefix}npm ${commandName}${trimmedSuffix}`;
    }

    if (packageManager === 'yarn') {
      if (commandName.includes(':')) {
        return `${commandPrefix}yarn ${commandName}${trimmedSuffix}`;
      }

      return `${commandPrefix}yarn ${commandName}${trimmedSuffix}`;
    }

    if (packageManager === 'bun') {
      if (commandName.includes(':')) {
        return `${commandPrefix}bun run ${commandName}${trimmedSuffix}`;
      }

      return `${commandPrefix}bun ${commandName}${trimmedSuffix}`;
    }

    return `${commandPrefix}pnpm ${commandName}${trimmedSuffix}`;
  });
}

function updateScriptValueForPackageManager(scriptValue, packageManager) {
  if (packageManager !== 'pnpm') {
    return convertPnpmCalls(scriptValue, packageManager);
  }

  return scriptValue;
}

function resolveAuditScript(packageManager) {
  if (packageManager === 'npm') {
    return 'npm audit --audit-level=high';
  }

  if (packageManager === 'yarn') {
    return 'yarn audit';
  }

  if (packageManager === 'bun') {
    return 'bun audit';
  }

  return 'pnpm audit --audit-level=high';
}

async function updatePackageJson(destinationProjectDir, packageManager) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.packageManager = buildPackageManagerValue(packageManager);

  if (packageJson.scripts) {
    for (const [scriptName, scriptValue] of Object.entries(packageJson.scripts)) {
      if (typeof scriptValue !== 'string') {
        continue;
      }

      packageJson.scripts[scriptName] = updateScriptValueForPackageManager(scriptValue, packageManager);
    }

    if (packageJson.scripts.audit) {
      packageJson.scripts.audit = resolveAuditScript(packageManager);
    }
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function updateDockerfile(destinationProjectDir, packageManager) {
  const dockerfilePath = path.join(destinationProjectDir, 'Dockerfile');
  const dockerfileStat = await stat(dockerfilePath).catch(() => null);

  if (!dockerfileStat?.isFile()) {
    return;
  }

  const dockerfileRaw = await readFile(dockerfilePath, 'utf8');
  let dockerfileUpdated = dockerfileRaw;

  if (packageManager === 'npm') {
    dockerfileUpdated = dockerfileUpdated
      .replace(/COPY package\.json pnpm-lock\.yaml \.\//g, 'COPY package.json ./')
      .replace(/RUN pnpm install(?: --frozen-lockfile)?/g, 'RUN npm install')
      .replace(/RUN pnpm prune --prod/g, 'RUN npm prune --omit=dev')
      .replace(/CMD \["sh", "-c", "pnpm prisma:bootstrap && pnpm start"\]/g, 'CMD ["sh", "-c", "npm run prisma:bootstrap && npm run start"]')
      .replace(/CMD \["sh", "-c", "pnpm start"\]/g, 'CMD ["sh", "-c", "npm run start"]');
  } else if (packageManager === 'yarn') {
    dockerfileUpdated = dockerfileUpdated
      .replace(/COPY package\.json pnpm-lock\.yaml \.\//g, 'COPY package.json ./')
      .replace(/RUN pnpm install(?: --frozen-lockfile)?/g, 'RUN yarn install')
      .replace(/RUN pnpm prune --prod/g, 'RUN yarn install --production')
      .replace(/CMD \["sh", "-c", "pnpm prisma:bootstrap && pnpm start"\]/g, 'CMD ["sh", "-c", "yarn prisma:bootstrap && yarn start"]')
      .replace(/CMD \["sh", "-c", "pnpm start"\]/g, 'CMD ["sh", "-c", "yarn start"]');
  } else if (packageManager === 'bun') {
    dockerfileUpdated = dockerfileUpdated
      .replace(/COPY package\.json pnpm-lock\.yaml \.\//g, 'COPY package.json ./')
      .replace(/RUN pnpm install(?: --frozen-lockfile)?/g, 'RUN bun install')
      .replace(/RUN pnpm prune --prod/g, 'RUN bun install --production')
      .replace(/CMD \["sh", "-c", "pnpm prisma:bootstrap && pnpm start"\]/g, 'CMD ["sh", "-c", "bun run prisma:bootstrap && bun run start"]')
      .replace(/CMD \["sh", "-c", "pnpm start"\]/g, 'CMD ["sh", "-c", "bun run start"]');
  }

  if (dockerfileUpdated !== dockerfileRaw) {
    await writeFile(dockerfilePath, dockerfileUpdated, 'utf8');
  }
}

async function updateReadme(destinationProjectDir, packageManager) {
  const readmePath = path.join(destinationProjectDir, 'README.md');
  const readmeStat = await stat(readmePath).catch(() => null);

  if (!readmeStat?.isFile() || packageManager === 'pnpm') {
    return;
  }

  const readmeRaw = await readFile(readmePath, 'utf8');
  const commandReplacements = [
    ['pnpm install', `${packageManager} install`],
    ['pnpm run dev', packageManager === 'npm' ? 'npm run dev' : packageManager === 'yarn' ? 'yarn dev' : packageManager === 'bun' ? 'bun run dev' : 'pnpm run dev'],
    ['pnpm dev', packageManager === 'npm' ? 'npm run dev' : packageManager === 'yarn' ? 'yarn dev' : packageManager === 'bun' ? 'bun run dev' : 'pnpm dev'],
    ['pnpm start', packageManager === 'npm' ? 'npm run start' : packageManager === 'yarn' ? 'yarn start' : packageManager === 'bun' ? 'bun run start' : 'pnpm start'],
    ['pnpm test', packageManager === 'npm' ? 'npm run test' : packageManager === 'yarn' ? 'yarn test' : packageManager === 'bun' ? 'bun run test' : 'pnpm test'],
    ['pnpm lint', packageManager === 'npm' ? 'npm run lint' : packageManager === 'yarn' ? 'yarn lint' : packageManager === 'bun' ? 'bun run lint' : 'pnpm lint'],
    ['pnpm prisma:bootstrap', packageManager === 'npm' ? 'npm run prisma:bootstrap' : packageManager === 'yarn' ? 'yarn prisma:bootstrap' : packageManager === 'bun' ? 'bun run prisma:bootstrap' : 'pnpm prisma:bootstrap'],
  ];

  const readmeUpdated = readmeRaw.replace(/```(bash|sh|shell)\n([\s\S]*?)\n```/g, (match, fenceLanguage, blockContent) => {
    let updatedBlock = blockContent;

    for (const [from, to] of commandReplacements) {
      updatedBlock = updatedBlock.replaceAll(from, to);
    }

    if (updatedBlock === blockContent) {
      return match;
    }

    return `\`\`\`${fenceLanguage}\n${updatedBlock}\n\`\`\``;
  });

  if (readmeUpdated !== readmeRaw) {
    await writeFile(readmePath, readmeUpdated, 'utf8');
  }
}

async function updateLockfiles(destinationProjectDir, packageManager) {
  if (packageManager === 'pnpm') {
    return;
  }

  const pnpmLockPath = path.join(destinationProjectDir, 'pnpm-lock.yaml');
  await rm(pnpmLockPath, { force: true });
}

export async function configureGeneratedPackageManager(destinationProjectDir, packageManager) {
  await updatePackageJson(destinationProjectDir, packageManager);
  await updateDockerfile(destinationProjectDir, packageManager);
  await updateReadme(destinationProjectDir, packageManager);
  await updateLockfiles(destinationProjectDir, packageManager);
}
