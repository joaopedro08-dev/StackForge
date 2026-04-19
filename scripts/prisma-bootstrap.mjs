import process from 'node:process';
import { spawn } from 'node:child_process';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolvePnpmInvocation() {
  const execPath = process.env.npm_execpath;

  if (execPath && execPath.toLowerCase().includes('pnpm')) {
    return {
      command: process.execPath,
      args: [execPath],
    };
  }

  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: [],
  };
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const shouldWrapWithCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
    const executable = shouldWrapWithCmd ? 'cmd.exe' : command;
    const executableArgs = shouldWrapWithCmd ? ['/d', '/s', '/c', command, ...args] : args;

    const child = spawn(executable, executableArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
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

function isTransientPrismaError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes('p1001') ||
    message.includes('timed out') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('could not connect') ||
    message.includes('server has closed the connection') ||
    message.includes('connection')
  );
}

async function main() {
  const provider = (process.env.DATABASE_PROVIDER ?? 'json').trim().toLowerCase();

  if (provider === 'json') {
    process.stdout.write('[bootstrap] DATABASE_PROVIDER=json, skipping Prisma bootstrap.\n');
    return;
  }

  const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
  if (!databaseUrl) {
    process.stderr.write('[bootstrap:error] DATABASE_URL is required for relational providers.\n');
    process.exitCode = 1;
    return;
  }

  const maxAttemptsRaw = process.env.PRISMA_BOOTSTRAP_MAX_ATTEMPTS ?? '5';
  const retryDelayRaw = process.env.PRISMA_BOOTSTRAP_RETRY_DELAY_MS ?? '3000';
  const maxAttempts = Number.parseInt(maxAttemptsRaw, 10);
  const retryDelayMs = Number.parseInt(retryDelayRaw, 10);

  const attempts = Number.isNaN(maxAttempts) || maxAttempts < 1 ? 5 : maxAttempts;
  const delayMs = Number.isNaN(retryDelayMs) || retryDelayMs < 0 ? 3000 : retryDelayMs;

  const invocation = resolvePnpmInvocation();
  const command = invocation.command;
  const args = [...invocation.args, 'prisma:push'];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      process.stdout.write(`[bootstrap] Running prisma push (${attempt}/${attempts})...\n`);
      await runCommand(command, args);
      process.stdout.write('[bootstrap] Prisma bootstrap completed.\n');
      return;
    } catch (error) {
      const isLastAttempt = attempt === attempts;
      const canRetry = !isLastAttempt && isTransientPrismaError(error);

      if (!canRetry) {
        throw error;
      }

      process.stdout.write(`[bootstrap] Transient database error. Retrying in ${delayMs}ms...\n`);
      await sleep(delayMs);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[bootstrap:error] ${message}\n`);
  process.exitCode = 1;
});
