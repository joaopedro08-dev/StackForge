import process from 'node:process';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import {
  assertCondition,
  assertFileExists,
  formatDurationMs,
  resolveScaffoldContext,
  runGenerator,
} from './scaffold/core/runtime.mjs';

const { rootDir, projectsRootDir, generatorScriptPath } = resolveScaffoldContext(import.meta.url);
const providers = ['json', 'postgresql', 'mysql', 'sqlite', 'sqlserver'];

function printProviderReport(results) {
  process.stdout.write('[smoke] provider summary\n');
  process.stdout.write('[smoke] provider | status | stage | duration\n');

  for (const result of results) {
    process.stdout.write(
      `[smoke] ${result.provider} | ${result.status} | ${result.stage} | ${formatDurationMs(result.durationMs)}\n`,
    );

    if (result.errorMessage) {
      process.stdout.write(`[smoke] ${result.provider} | error | ${result.errorMessage}\n`);
    }
  }

  const passedCount = results.filter((result) => result.status === 'PASS').length;
  const failedCount = results.filter((result) => result.status === 'FAIL').length;

  process.stdout.write(`[smoke] totals | passed=${passedCount} | failed=${failedCount} | total=${results.length}\n`);
}

function assertJsonPackageShape(packageJson) {
  const scriptNames = ['prisma:generate', 'prisma:migrate', 'prisma:deploy', 'prisma:push', 'prisma:bootstrap'];

  for (const scriptName of scriptNames) {
    assertCondition(!packageJson.scripts?.[scriptName], `JSON mode should not contain script ${scriptName}`);
  }

  assertCondition(!packageJson.dependencies?.prisma, 'JSON mode should not depend on prisma');
  assertCondition(!packageJson.dependencies?.['@prisma/client'], 'JSON mode should not depend on @prisma/client');
}

function assertRelationalPackageShape(packageJson) {
  assertCondition(Boolean(packageJson.scripts?.['prisma:generate']), 'Relational mode should include prisma:generate');
  assertCondition(Boolean(packageJson.scripts?.['prisma:bootstrap']), 'Relational mode should include prisma:bootstrap');
  assertCondition(Boolean(packageJson.dependencies?.prisma), 'Relational mode should depend on prisma');
  assertCondition(Boolean(packageJson.dependencies?.['@prisma/client']), 'Relational mode should depend on @prisma/client');
}

async function validateGeneratedProject(projectDir, provider) {
  const envExamplePath = path.join(projectDir, '.env.example');
  const packageJsonPath = path.join(projectDir, 'package.json');
  const dockerfilePath = path.join(projectDir, 'Dockerfile');

  await assertFileExists(envExamplePath);
  await assertFileExists(packageJsonPath);
  await assertFileExists(dockerfilePath);

  const envExampleRaw = await readFile(envExamplePath, 'utf8');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const dockerfileRaw = await readFile(dockerfilePath, 'utf8');

  assertCondition(!packageJson.scripts?.['test:scaffold:db'], 'Generated projects should not include internal test:scaffold:db script');

  assertCondition(
    envExampleRaw.includes(`DATABASE_PROVIDER=${provider}`),
    `.env.example does not declare expected provider ${provider}`,
  );

  if (provider === 'json') {
    assertJsonPackageShape(packageJson);
    assertCondition(!dockerfileRaw.includes('pnpm prisma:generate'), 'JSON mode Dockerfile should not run prisma:generate');
    assertCondition(
      !dockerfileRaw.includes('pnpm prisma:bootstrap && pnpm start'),
      'JSON mode Dockerfile should not run prisma:bootstrap at startup',
    );
    assertCondition(dockerfileRaw.includes('CMD ["sh", "-c", "pnpm start"]'), 'JSON mode Dockerfile should start with pnpm start');
    return;
  }

  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
  await assertFileExists(schemaPath);
  const schemaRaw = await readFile(schemaPath, 'utf8');

  assertRelationalPackageShape(packageJson);
  assertCondition(dockerfileRaw.includes('pnpm prisma:generate'), 'Relational mode Dockerfile should run prisma:generate');
  assertCondition(
    dockerfileRaw.includes('CMD ["sh", "-c", "pnpm prisma:bootstrap && pnpm start"]'),
    'Relational mode Dockerfile should run prisma:bootstrap at startup',
  );
  assertCondition(
    schemaRaw.includes(`provider = "${provider}"`),
    `schema.prisma should define datasource provider ${provider}`,
  );
}

async function main() {
  const runDir = await mkdtemp(path.join(projectsRootDir, 'scaffold-db-smoke-'));
  const generatedProjectNames = [];
  const providerResults = [];

  try {
    for (const provider of providers) {
      const projectName = `${path.basename(runDir)}-${provider}`;
      const projectDir = path.join(projectsRootDir, projectName);
      generatedProjectNames.push(projectName);
      const startedAt = Date.now();
      const result = {
        provider,
        status: 'PASS',
        stage: 'complete',
        durationMs: 0,
        errorMessage: '',
      };

      providerResults.push(result);

      try {
        result.stage = 'generate';
        process.stdout.write(`[smoke] generating provider=${provider}\n`);
        await runGenerator(rootDir, generatorScriptPath, [projectName, `--db=${provider}`]);

        result.stage = 'validate';
        process.stdout.write(`[smoke] validating provider=${provider}\n`);
        await validateGeneratedProject(projectDir, provider);
      } catch (error) {
        result.status = 'FAIL';
        result.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        result.durationMs = Date.now() - startedAt;
      }
    }

    printProviderReport(providerResults);
    process.stdout.write('[smoke] all provider checks passed\n');
  } finally {
    if (providerResults.some((result) => result.status === 'FAIL')) {
      printProviderReport(providerResults);
    }

    for (const projectName of generatedProjectNames) {
      const projectDir = path.join(projectsRootDir, projectName);
      await rm(projectDir, { recursive: true, force: true });
    }

    await rm(runDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[smoke:error] ${message}\n`);
  process.exitCode = 1;
});
