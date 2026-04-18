import { spawn } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';

const defaultDbPort = process.env.POSTGRES_HOST_PORT || '55432';

function parseArgs(args) {
  const options = {
    dbPort: defaultDbPort,
    skipSmoke: false,
    build: false,
  };

  for (const arg of args) {
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--skip-smoke') {
      options.skipSmoke = true;
      continue;
    }

    if (arg === '--build') {
      options.build = true;
      continue;
    }

    if (arg.startsWith('--db-port=')) {
      options.dbPort = arg.slice('--db-port='.length).trim();
      continue;
    }

    if (/^\d+$/.test(arg)) {
      options.dbPort = arg;
      continue;
    }

    throw new Error(`Invalid argument: ${arg}`);
  }

  if (!/^\d+$/.test(options.dbPort)) {
    throw new Error('Database port must be numeric.');
  }

  return options;
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env,
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

async function main() {
  const { dbPort, skipSmoke, build } = parseArgs(process.argv.slice(2));
  const env = {
    ...process.env,
    POSTGRES_HOST_PORT: dbPort,
  };

  console.log(`[start] Starting production stack with POSTGRES_HOST_PORT=${dbPort} build=${build}`);

  const composeUpArgs = ['compose', '--env-file', '.env.production', '-f', 'docker-compose.production.yml', 'up', '-d'];

  if (build) {
    composeUpArgs.push('--build');
  }

  await runCommand('docker', composeUpArgs, env);
  await runCommand('docker', ['compose', '--env-file', '.env.production', '-f', 'docker-compose.production.yml', 'ps'], env);

  if (!skipSmoke) {
    await runCommand('node', ['scripts/production-smoke.mjs'], env);
  }

  console.log('[done] Production stack is ready with a custom PostgreSQL host port.');
  console.log(`[next] To stop on PowerShell: $env:POSTGRES_HOST_PORT='${dbPort}'; pnpm prod:down`);
}

main().catch((error) => {
  console.error(`[error] ${error.message}`);
  process.exit(1);
});
