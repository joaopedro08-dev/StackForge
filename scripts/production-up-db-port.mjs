import console from 'node:console';
import process from 'node:process';
import { runCommand } from './production/core/process-runner.mjs';
import { parseUpArgs } from './production/core/up-options.mjs';

async function main() {
  const { dbPort, skipSmoke, build } = parseUpArgs(process.argv.slice(2));
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
