import path from 'node:path';
import { readFile, writeFile, stat } from 'node:fs/promises';

function getDefaultDatabaseUrl(databaseProvider) {
  if (databaseProvider === 'postgresql') {
    return 'postgresql://postgres:postgres@localhost:5432/authentication_api?schema=public';
  }

  if (databaseProvider === 'mysql') {
    return 'mysql://root:root@localhost:3306/authentication_api';
  }

  if (databaseProvider === 'sqlserver') {
    return 'sqlserver://sa:yourStrong(!)Password@localhost:1433?database=authentication_api';
  }

  if (databaseProvider === 'sqlite') {
    return 'file:./prisma/dev.db';
  }

  return '';
}

async function updateGeneratedEnvFiles(destinationProjectDir, databaseProvider) {
  const envFiles = ['.env.example', '.env.production.example'];
  const defaultUrl = getDefaultDatabaseUrl(databaseProvider);

  for (const fileName of envFiles) {
    const envPath = path.join(destinationProjectDir, fileName);
    const envStat = await stat(envPath).catch(() => null);

    if (!envStat?.isFile()) {
      continue;
    }

    const envRaw = await readFile(envPath, 'utf8');
    const envUpdated = envRaw
      .replace(/^DATABASE_PROVIDER=.*$/m, `DATABASE_PROVIDER=${databaseProvider}`)
      .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${defaultUrl}`);

    if (envUpdated !== envRaw) {
      await writeFile(envPath, envUpdated, 'utf8');
    }
  }
}

async function updateGeneratedPackageJsonDatabaseSettings(destinationProjectDir, databaseProvider) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.scripts = packageJson.scripts || {};
  packageJson.dependencies = packageJson.dependencies || {};

  if (databaseProvider === 'json') {
    for (const scriptName of ['prisma:generate', 'prisma:migrate', 'prisma:deploy', 'prisma:push', 'prisma:bootstrap']) {
      delete packageJson.scripts[scriptName];
    }

    delete packageJson.dependencies.prisma;
    delete packageJson.dependencies['@prisma/client'];
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function updateGeneratedDockerfileDatabaseStartup(destinationProjectDir, databaseProvider) {
  const dockerfilePath = path.join(destinationProjectDir, 'Dockerfile');
  const dockerfileStat = await stat(dockerfilePath).catch(() => null);

  if (!dockerfileStat?.isFile()) {
    return;
  }

  const dockerfileRaw = await readFile(dockerfilePath, 'utf8');
  let dockerfileUpdated = dockerfileRaw;

  if (databaseProvider === 'json') {
    dockerfileUpdated = dockerfileUpdated
      .replace('RUN pnpm install --frozen-lockfile', 'RUN pnpm install')
      .replace(/RUN pnpm prisma:generate\r?\n/, '')
      .replace(
        /CMD\s+\["sh",\s*"-c",\s*"pnpm prisma:bootstrap && pnpm start"\]/,
        'CMD ["sh", "-c", "pnpm start"]',
      );
  } else {
    dockerfileUpdated = dockerfileUpdated
      .replace(/RUN pnpm install(?: --frozen-lockfile)?/, 'RUN pnpm install --frozen-lockfile')
      .replace(
        /CMD\s+\["sh",\s*"-c",\s*"pnpm start"\]/,
        'CMD ["sh", "-c", "pnpm prisma:bootstrap && pnpm start"]',
      );
  }

  if (dockerfileUpdated !== dockerfileRaw) {
    await writeFile(dockerfilePath, dockerfileUpdated, 'utf8');
  }
}

async function updateGeneratedPrismaSchemaProvider(destinationProjectDir, databaseProvider) {
  const schemaPath = path.join(destinationProjectDir, 'prisma', 'schema.prisma');
  const schemaStat = await stat(schemaPath).catch(() => null);

  if (!schemaStat?.isFile()) {
    return;
  }

  const schemaRaw = await readFile(schemaPath, 'utf8');
  let schemaUpdated = schemaRaw.replace(
    /datasource\s+db\s*\{([\s\S]*?)provider\s*=\s*"[^"]+"/m,
    `datasource db {$1provider = "${databaseProvider}"`,
  );

  if (databaseProvider !== 'postgresql') {
    schemaUpdated = schemaUpdated.replace(/\s+@db\.Uuid/g, '');
  }

  if (schemaUpdated !== schemaRaw) {
    await writeFile(schemaPath, schemaUpdated, 'utf8');
  }
}

export async function configureGeneratedDatabase(destinationProjectDir, databaseProvider) {
  await updateGeneratedEnvFiles(destinationProjectDir, databaseProvider);
  await updateGeneratedPackageJsonDatabaseSettings(destinationProjectDir, databaseProvider);
  await updateGeneratedDockerfileDatabaseStartup(destinationProjectDir, databaseProvider);

  if (databaseProvider === 'json') {
    return;
  }

  await updateGeneratedPrismaSchemaProvider(destinationProjectDir, databaseProvider);
}
