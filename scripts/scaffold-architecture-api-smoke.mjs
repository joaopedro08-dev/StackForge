import process from 'node:process';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import {
  assertCondition,
  assertFileExists,
  assertFileMissing,
  formatDurationMs,
  readFirstExistingFile,
  resolveScaffoldContext,
  runGenerator,
} from './scaffold/core/runtime.mjs';

const { rootDir, projectsRootDir, generatorScriptPath } = resolveScaffoldContext(import.meta.url);

const scenarios = [
  { architecture: 'layered', apiStyle: 'rest', database: 'json', language: 'javascript', profile: 'lite', featureSet: 'auth' },
  { architecture: 'mvc', apiStyle: 'rest', database: 'postgresql', language: 'javascript', profile: 'lite', featureSet: 'none' },
  { architecture: 'clean', apiStyle: 'graphql', database: 'postgresql', language: 'javascript', profile: 'lite', featureSet: 'auth' },
  { architecture: 'layered', apiStyle: 'hybrid', database: 'mysql', language: 'javascript', profile: 'lite', featureSet: 'both' },
  { architecture: 'clean', apiStyle: 'graphql', database: 'postgresql', language: 'typescript', profile: 'lite', featureSet: 'none' },
  { architecture: 'layered', apiStyle: 'hybrid', database: 'postgresql', language: 'typescript', profile: 'lite', featureSet: 'both' },
  { architecture: 'clean', apiStyle: 'graphql', database: 'postgresql', language: 'javascript', profile: 'full', featureSet: 'auth' },
  { architecture: 'layered', apiStyle: 'hybrid', database: 'postgresql', language: 'typescript', profile: 'full', featureSet: 'both' },
];

function scenarioLabel(scenario) {
  return `${scenario.architecture}+${scenario.apiStyle}+${scenario.database}+${scenario.language}+${scenario.profile}+${scenario.featureSet}`;
}

async function runGeneratorScenario(projectName, scenario) {
  const args = [
    projectName,
    `--db=${scenario.database}`,
    `--architecture=${scenario.architecture}`,
    `--api=${scenario.apiStyle}`,
    `--lang=${scenario.language}`,
    `--features=${scenario.featureSet}`,
  ];

  const targetProjectDir = path.join(rootDir, 'developers', 'projects', projectName.toLowerCase());
  await rm(targetProjectDir, { recursive: true, force: true });

  if (scenario.profile === 'full') {
    args.push('--full');
  }

  await runGenerator(rootDir, generatorScriptPath, args);
}

async function validateArchitecture(projectDir, architecture) {
  const architectureDocPath = path.join(projectDir, 'docs', 'architecture.md');
  await assertFileExists(architectureDocPath);

  const architectureDoc = await readFile(architectureDocPath, 'utf8');
  assertCondition(
    architectureDoc.includes(`Selected architecture: ${architecture}`),
    `Architecture doc should include selected architecture ${architecture}`,
  );

  if (architecture === 'mvc') {
    for (const relativeDir of ['src/models', 'src/views', 'src/controllers', 'src/config', 'src/db', 'src/middlewares', 'src/routes', 'src/utils']) {
      await assertFileExists(path.join(projectDir, relativeDir));
    }

    for (const relativeDir of ['src/modules', 'src/docs']) {
      await assertFileMissing(path.join(projectDir, relativeDir));
    }
  }

  if (architecture === 'clean') {
    for (const relativeDir of ['src/domain', 'src/application', 'src/infrastructure', 'src/interfaces/http']) {
      await assertFileExists(path.join(projectDir, relativeDir));
    }
  }
}

async function validateApiStyle(projectDir, scenario) {
  const { architecture, apiStyle, language, profile } = scenario;
  const envPath = path.join(projectDir, '.env.example');
  const packageJsonPath = path.join(projectDir, 'package.json');
  const graphQlServerPath = path.join(projectDir, 'src', 'graphql', language === 'typescript' ? 'server.ts' : 'server.js');
  const appPath = path.join(projectDir, 'src', language === 'typescript' ? 'app.ts' : 'app.js');
  const openApiFolder = architecture === 'mvc' ? 'config' : 'docs';
  const openApiDocPath = path.join(projectDir, 'src', openApiFolder, language === 'typescript' ? 'openapi.ts' : 'openapi.js');

  const envRaw = await readFile(envPath, 'utf8');
  const appRaw = await readFile(appPath, 'utf8');
  const openApiDocRaw = await readFile(openApiDocPath, 'utf8');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

  assertCondition(envRaw.includes(`API_STYLE=${apiStyle}`), `.env.example should include API_STYLE=${apiStyle}`);
  assertCondition(appRaw.includes('mountGraphQLIfEnabled'), 'App should include GraphQL mount helper');

  const hasGraphQlDeps =
    Boolean(packageJson.dependencies?.graphql) &&
    Boolean(packageJson.dependencies?.['@apollo/server']) &&
    Boolean(packageJson.dependencies?.['@as-integrations/express5']);

  if (language === 'typescript') {
    assertCondition(Boolean(packageJson.scripts?.typecheck), 'TypeScript scenario should include typecheck script');
    await readFirstExistingFile([path.join(projectDir, 'index.ts')]);
  }

  if (apiStyle === 'rest') {
    await assertFileMissing(graphQlServerPath);
    assertCondition(!hasGraphQlDeps, 'REST style should not include GraphQL dependencies');
    assertCondition(openApiDocRaw.includes("'/auth/login'"), 'REST style OpenAPI should include auth routes');
    assertCondition(!openApiDocRaw.includes("'/graphql'"), 'REST style OpenAPI should not include graphql route');
    return;
  }

  await assertFileExists(graphQlServerPath);
  assertCondition(hasGraphQlDeps, `${apiStyle} style should include GraphQL dependencies`);

  if (apiStyle === 'graphql') {
    assertCondition(!openApiDocRaw.includes("'/auth/login'"), 'GraphQL style OpenAPI should not include auth REST routes');
    assertCondition(openApiDocRaw.includes("'/graphql'"), 'GraphQL style OpenAPI should include graphql route');
  }

  if (apiStyle === 'hybrid') {
    assertCondition(openApiDocRaw.includes("'/auth/login'"), 'Hybrid style OpenAPI should include auth REST routes');
    assertCondition(openApiDocRaw.includes("'/graphql'"), 'Hybrid style OpenAPI should include graphql route');
  }

  if (profile === 'full') {
    const testExtension = language === 'typescript' ? 'ts' : 'js';
    const graphqlTestPath = path.join(projectDir, 'tests', 'integration', `graphql.http.test.${testExtension}`);
    const authTestPath = path.join(projectDir, 'tests', 'integration', `auth.http.test.${testExtension}`);

    if (apiStyle === 'graphql') {
      await assertFileExists(graphqlTestPath);
      await assertFileMissing(authTestPath);
    }

    if (apiStyle === 'hybrid') {
      await assertFileExists(graphqlTestPath);
      await assertFileExists(authTestPath);
    }
  }
}

function printScenarioReport(results) {
  process.stdout.write('[smoke] architecture/api summary\n');
  process.stdout.write('[smoke] scenario | status | stage | duration\n');

  for (const result of results) {
    process.stdout.write(
      `[smoke] ${result.label} | ${result.status} | ${result.stage} | ${formatDurationMs(result.durationMs)}\n`,
    );

    if (result.errorMessage) {
      process.stdout.write(`[smoke] ${result.label} | error | ${result.errorMessage}\n`);
    }
  }

  const passedCount = results.filter((result) => result.status === 'PASS').length;
  const failedCount = results.filter((result) => result.status === 'FAIL').length;
  process.stdout.write(`[smoke] totals | passed=${passedCount} | failed=${failedCount} | total=${results.length}\n`);
}

async function main() {
  const runDir = await mkdtemp(path.join(projectsRootDir, 'scaffold-arch-api-smoke-'));
  const generatedProjectNames = [];
  const scenarioResults = [];

  try {
    for (const scenario of scenarios) {
      const label = scenarioLabel(scenario);
      const projectName = `${path.basename(runDir)}-${scenario.architecture}-${scenario.apiStyle}-${scenario.database}-${scenario.language}`.toLowerCase();
      const projectDir = path.join(projectsRootDir, projectName);
      const startedAt = Date.now();

      generatedProjectNames.push(projectName);

      const result = {
        label,
        status: 'PASS',
        stage: 'complete',
        durationMs: 0,
        errorMessage: '',
      };
      scenarioResults.push(result);

      try {
        result.stage = 'generate';
        process.stdout.write(`[smoke] generating scenario=${label}\n`);
        await runGeneratorScenario(projectName, scenario);

        result.stage = 'validate-architecture';
        await validateArchitecture(projectDir, scenario.architecture);

        result.stage = 'validate-api';
        await validateApiStyle(projectDir, scenario);
      } catch (error) {
        result.status = 'FAIL';
        result.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        result.durationMs = Date.now() - startedAt;
      }
    }

    printScenarioReport(scenarioResults);
    process.stdout.write('[smoke] all architecture/api checks passed\n');
  } finally {
    if (scenarioResults.some((result) => result.status === 'FAIL')) {
      printScenarioReport(scenarioResults);
    }

    for (const projectName of generatedProjectNames) {
      await rm(path.join(projectsRootDir, projectName), { recursive: true, force: true });
    }

    await rm(runDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[smoke:error] ${message}\n`);
  process.exitCode = 1;
});
