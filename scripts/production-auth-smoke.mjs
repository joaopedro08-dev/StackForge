import process from 'node:process';
import crypto from 'node:crypto';
import { assertCondition } from './production/core/assert.mjs';
import { createCookieJsonClient } from './production/core/http.mjs';
import { consoleApi, fetchApi, runWithExitCode } from './production/core/runtime.mjs';

const BASE_URL = process.env.PROD_BASE_URL || 'http://localhost:3001';
const { requestJson, cookieJar } = createCookieJsonClient(BASE_URL, fetchApi);

async function main() {
  const email = `smoke-${crypto.randomUUID()}@test.local`;
  const password = 'StrongPass123';

  consoleApi.log(`[start] auth smoke baseUrl=${BASE_URL}`);

  const register = await requestJson('/auth/register', {
    method: 'POST',
    body: {
      name: 'Smoke User',
      email,
      password,
      confirmPassword: password,
    },
  });

  assertCondition(register?.user?.email === email, 'Register did not return the expected user.');
  assertCondition(typeof register?.accessToken === 'string', 'Register did not return an access token.');
  assertCondition(typeof register?.csrfToken === 'string', 'Register did not return a CSRF token.');
  assertCondition(cookieJar.has('refreshToken'), 'Missing refreshToken cookie after register.');
  assertCondition(cookieJar.has('csrfToken'), 'Missing csrfToken cookie after register.');

  consoleApi.log('[ok] register');

  const refresh = await requestJson('/auth/refresh-token', {
    method: 'POST',
    headers: {
      'x-csrf-token': register.csrfToken,
    },
  });

  assertCondition(refresh?.user?.email === email, 'Refresh did not return the expected user.');
  assertCondition(typeof refresh?.accessToken === 'string', 'Refresh did not return an access token.');
  assertCondition(typeof refresh?.csrfToken === 'string', 'Refresh did not return a CSRF token.');

  consoleApi.log('[ok] refresh-token');

  const logout = await requestJson('/auth/logout', {
    method: 'POST',
    headers: {
      'x-csrf-token': refresh.csrfToken,
    },
  });

  assertCondition(logout?.message === 'Logged out successfully.', 'Logout did not return the expected message.');

  consoleApi.log('[ok] logout');
  consoleApi.log('[done] auth smoke test completed successfully');
}

runWithExitCode(main);
