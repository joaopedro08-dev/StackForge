import process from 'node:process';

export const consoleApi = globalThis.console;
export const fetchApi = globalThis.fetch;

if (!consoleApi) {
  throw new Error('Console API is not available in the current Node.js runtime.');
}

if (typeof fetchApi !== 'function') {
  throw new Error('Fetch API is not available in the current Node.js runtime.');
}

export function parseIntEnv(name, fallback) {
  return Number.parseInt(process.env[name] || String(fallback), 10);
}

export async function runWithExitCode(mainFn) {
  try {
    await mainFn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    consoleApi.error(`[error] ${message}`);
    process.exitCode = 1;
  }
}
