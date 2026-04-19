import process from 'node:process';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { formatDurationMs, resolveScaffoldContext, runGenerator } from './scaffold/core/runtime.mjs';

const { rootDir, projectsRootDir, generatorScriptPath } = resolveScaffoldContext(import.meta.url);

const scenarios = [
  {
    name: 'full-js-json-rest-pnpm',
    packageManager: 'pnpm',
    args: ['--full', '--db=json', '--lang=javascript', '--api=rest', '--architecture=layered', '--pm=pnpm'],
  },
  {
    name: 'full-js-json-rest-yarn',
    packageManager: 'yarn',
    args: ['--full', '--db=json', '--lang=javascript', '--api=rest', '--architecture=layered', '--pm=yarn'],
  },
  {
    name: 'full-js-json-rest-bun',
    packageManager: 'bun',
    args: ['--full', '--db=json', '--lang=javascript', '--api=rest', '--architecture=layered', '--pm=bun'],
  },
];

function normalizeRuntimeMode(rawMode) {
  const mode = (rawMode ?? '').toLowerCase().trim();
  if (mode === 'quick' || mode === 'full') {
    return mode;
  }

  if (mode.length > 0) {
    throw new Error(`Invalid SCAFFOLD_FULL_RUNTIME_MODE value: ${rawMode}. Expected quick or full.`);
  }

  return 'full';
}

function selectScenarios(mode) {
  if (mode === 'quick') {
    return scenarios.slice(0, 1);
  }

  return scenarios;
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function pnpmInvocation() {
  const execPath = process.env.npm_execpath;

  if (execPath && execPath.toLowerCase().includes('pnpm')) {
    return { command: process.execPath, args: [execPath] };
  }

  return { command: pnpmCommand(), args: [] };
}

function packageManagerCommand(packageManager, scriptName) {
  if (packageManager === 'npm') {
    return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', scriptName] };
  }

  if (packageManager === 'yarn') {
    return { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', args: ['yarn', scriptName] };
  }

  if (packageManager === 'bun') {
    return { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', args: ['bun', 'run', scriptName] };
  }

  if (packageManager === 'pnpm') {
    const invocation = pnpmInvocation();
    return {
      command: invocation.command,
      args: [...invocation.args, scriptName],
    };
  }

  return { command: pnpmCommand(), args: [scriptName] };
}

function isPackageManagerUnavailableError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes('not recognized as an internal or external command') ||
    message.includes('is not recognized') ||
    message.includes('enoent') ||
    message.includes('cannot find the file specified') ||
    message.includes('executable not found') ||
    message.includes('unknown syntax error') ||
    message.includes('command not found') ||
    message.includes('did you mean one of') ||
    message.includes('while running bun install')
  );
}

async function isPackageManagerAvailable(packageManager) {
  if (packageManager === 'pnpm' || packageManager === 'npm' || packageManager === 'yarn') {
    return true;
  }

  const availabilityCommand = packageManagerCommand(packageManager, '--version');

  try {
    await runCommand(availabilityCommand.command, availabilityCommand.args, projectsRootDir, process.env, {
      quiet: true,
    });
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args, cwd, env = process.env, options = {}) {
  return new Promise((resolve, reject) => {
    const stdioMode = options.quiet ? 'pipe' : 'inherit';
    const shouldWrapWithCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
    const executable = shouldWrapWithCmd ? 'cmd.exe' : command;
    const executableArgs = shouldWrapWithCmd ? ['/d', '/s', '/c', command, ...args] : args;

    const child = spawn(executable, executableArgs, {
      cwd,
      env,
      stdio: stdioMode,
      shell: false,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed (${command} ${args.join(' ')}) with exit code ${code}`));
    });
  });
}

function isTransientInstallError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes('esockettimedout') ||
    message.includes('etimedout') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('network connection') ||
    message.includes('fetch failed') ||
    message.includes('gateway timeout') ||
    message.includes('502 bad gateway') ||
    message.includes('503 service unavailable')
  );
}

async function runInstallWithRetry(command, args, cwd, env, packageManager, maxAttempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runCommand(command, args, cwd, env);
      return;
    } catch (error) {
      lastError = error;

      const canRetry = isTransientInstallError(error) && attempt < maxAttempts;
      if (!canRetry) {
        throw error;
      }

      process.stdout.write(
        `[smoke] install retry ${attempt}/${maxAttempts - 1} for ${packageManager} after transient network error\n`,
      );
    }
  }

  throw lastError;
}

function printSummary(results) {
  process.stdout.write('[smoke] scaffold full-runtime summary\n');
  process.stdout.write('[smoke] scenario | status | stage | duration\n');

  for (const result of results) {
    process.stdout.write(
      `[smoke] ${result.name} | ${result.status} | ${result.stage} | ${formatDurationMs(result.durationMs)}\n`,
    );

    if (result.errorMessage) {
      process.stdout.write(`[smoke] ${result.name} | error | ${result.errorMessage}\n`);
    }
  }

  const passedCount = results.filter((result) => result.status === 'PASS').length;
  const skippedCount = results.filter((result) => result.status === 'SKIP').length;
  const failedCount = results.filter((result) => result.status === 'FAIL').length;
  process.stdout.write(
    `[smoke] totals | passed=${passedCount} | skipped=${skippedCount} | failed=${failedCount} | total=${results.length}\n`,
  );
}

async function main() {
  const runtimeMode = normalizeRuntimeMode(process.env.SCAFFOLD_FULL_RUNTIME_MODE);
  const selectedScenarios = selectScenarios(runtimeMode);
  const runDir = await mkdtemp(path.join(projectsRootDir, 'scaffold-full-runtime-smoke-'));
  const generatedProjectNames = [];
  const cacheDirsToCleanup = [];
  const scenarioResults = [];

  try {
    process.stdout.write(`[smoke] full-runtime mode=${runtimeMode} scenarios=${selectedScenarios.length}\n`);

    for (const scenario of selectedScenarios) {
      const projectName = `${path.basename(runDir)}-${scenario.name}`.toLowerCase();
      const projectDir = path.join(projectsRootDir, projectName);
      const startedAt = Date.now();
      const scenarioEnv = { ...process.env };

      generatedProjectNames.push(projectName);

      const result = {
        name: scenario.name,
        status: 'PASS',
        stage: 'complete',
        durationMs: 0,
        errorMessage: '',
      };
      scenarioResults.push(result);

      if (!(await isPackageManagerAvailable(scenario.packageManager))) {
        result.status = 'SKIP';
        result.stage = 'unavailable';
        result.durationMs = Date.now() - startedAt;
        result.errorMessage = `${scenario.packageManager} is not available in this environment; scenario skipped.`;
        process.stdout.write(`[smoke] skipping scenario=${scenario.name} because ${scenario.packageManager} is unavailable\n`);
        continue;
      }

      try {
        result.stage = 'generate';
        process.stdout.write(`[smoke] generating scenario=${scenario.name}\n`);
        await runGenerator(rootDir, generatorScriptPath, [projectName, ...scenario.args]);

        if (scenario.packageManager === 'yarn') {
          const yarnCacheDir = await mkdtemp(path.join(runDir, 'yarn-cache-'));
          cacheDirsToCleanup.push(yarnCacheDir);
          scenarioEnv.YARN_CACHE_FOLDER = yarnCacheDir;
        }

        result.stage = 'install';
        process.stdout.write(`[smoke] installing scenario=${scenario.name}\n`);
        const installCommand =
          scenario.packageManager === 'npm'
            ? { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['install'] }
            : scenario.packageManager === 'yarn'
              ? { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', args: ['yarn', 'install', '--cache-folder', scenarioEnv.YARN_CACHE_FOLDER] }
              : scenario.packageManager === 'bun'
                ? { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', args: ['bun', 'install'] }
                : (() => {
                    const invocation = pnpmInvocation();
                    return {
                      command: invocation.command,
                      args: [...invocation.args, 'install'],
                    };
                  })();
        await runInstallWithRetry(
          installCommand.command,
          installCommand.args,
          projectDir,
          scenarioEnv,
          scenario.packageManager,
        );

        result.stage = 'lint';
        process.stdout.write(`[smoke] lint scenario=${scenario.name}\n`);
        const lintCommand = packageManagerCommand(scenario.packageManager, 'lint');
        await runCommand(lintCommand.command, lintCommand.args, projectDir, scenarioEnv);

        result.stage = 'test';
        process.stdout.write(`[smoke] test scenario=${scenario.name}\n`);
        const testCommand = packageManagerCommand(scenario.packageManager, 'test');
        await runCommand(testCommand.command, testCommand.args, projectDir, scenarioEnv);
      } catch (error) {
        if (scenario.packageManager !== 'pnpm' && isPackageManagerUnavailableError(error)) {
          result.status = 'SKIP';
          result.stage = 'unavailable';
          result.errorMessage = `${scenario.packageManager} is not available in this environment; scenario skipped.`;
          process.stdout.write(`[smoke] skipping scenario=${scenario.name} because ${scenario.packageManager} is unavailable\n`);
          continue;
        }

        result.status = 'FAIL';
        result.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        result.durationMs = Date.now() - startedAt;
      }
    }

    printSummary(scenarioResults);
    process.stdout.write('[smoke] scaffold full-runtime checks passed\n');
  } finally {
    if (scenarioResults.some((result) => result.status === 'FAIL')) {
      printSummary(scenarioResults);
    }

    for (const projectName of generatedProjectNames) {
      await rm(path.join(projectsRootDir, projectName), { recursive: true, force: true });
    }

    for (const cacheDir of cacheDirsToCleanup) {
      await rm(cacheDir, { recursive: true, force: true });
    }

    await rm(runDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[smoke:error] ${message}\n`);
  process.exitCode = 1;
});
