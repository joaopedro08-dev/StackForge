import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { getJson } from './production/core/http.mjs';
import { consoleApi, parseIntEnv, runWithExitCode } from './production/core/runtime.mjs';

const BASE_URL = process.env.PROD_BASE_URL || 'http://localhost:3001';
const RETRIES = parseIntEnv('PROD_SMOKE_RETRIES', 12);
const DELAY_MS = parseIntEnv('PROD_SMOKE_DELAY_MS', 2000);

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

runWithExitCode(main);
