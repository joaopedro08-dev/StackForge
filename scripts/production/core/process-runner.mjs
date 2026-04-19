import { spawn } from 'node:child_process';

export function runCommand(command, args, env, spawnFn = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, {
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
