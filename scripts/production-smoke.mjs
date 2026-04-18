import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const fetchApi = globalThis.fetch;
const consoleApi = globalThis.console;

if (typeof fetchApi !== 'function') {
  throw new Error('Fetch API is not available in the current Node.js runtime.');
}

if (!consoleApi) {
  throw new Error('Console API is not available in the current Node.js runtime.');
}

const BASE_URL = process.env.PROD_BASE_URL || 'http://localhost:3001';
const RETRIES = Number.parseInt(process.env.PROD_SMOKE_RETRIES || '12', 10);
const DELAY_MS = Number.parseInt(process.env.PROD_SMOKE_DELAY_MS || '2000', 10);

const endpoints = [
  {
    name: 'liveness',
    path: '/health/liveness',
    validate: (payload) => payload?.status === 'ok',
  },
  {
    name: 'readiness',
    path: '/health/readiness',
    validate: (payload) => payload?.status === 'ok' && payload?.checks?.database?.ok === true,
  },
];

async function getJson(url) {
  const response = await fetchApi(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function probeWithRetry(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  let lastError = null;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const payload = await getJson(url);

      if (!endpoint.validate(payload)) {
        throw new Error(`Invalid payload: ${JSON.stringify(payload)}`);
      }

      consoleApi.log(`[ok] ${endpoint.name} attempt=${attempt} url=${url}`);
      return payload;
    } catch (error) {
      lastError = error;
      consoleApi.log(`[retry] ${endpoint.name} attempt=${attempt}/${RETRIES} url=${url} reason=${error.message}`);

      if (attempt < RETRIES) {
        await delay(DELAY_MS);
      }
    }
  }

  throw new Error(`Failed ${endpoint.name} after ${RETRIES} attempts: ${lastError?.message || 'unknown error'}`);
}

async function main() {
  consoleApi.log(`[start] smoke test baseUrl=${BASE_URL} retries=${RETRIES} delayMs=${DELAY_MS}`);

  for (const endpoint of endpoints) {
    await probeWithRetry(endpoint);
  }

  consoleApi.log('[done] production smoke test completed successfully');
}

main().catch((error) => {
  consoleApi.error(`[error] ${error.message}`);
  process.exitCode = 1;
});
