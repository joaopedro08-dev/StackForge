import process from 'node:process';
import crypto from 'node:crypto';

const fetchApi = globalThis.fetch;
const consoleApi = globalThis.console;

if (typeof fetchApi !== 'function') {
  throw new Error('Fetch API is not available in the current Node.js runtime.');
}

if (!consoleApi) {
  throw new Error('Console API is not available in the current Node.js runtime.');
}

const BASE_URL = process.env.PROD_BASE_URL || 'http://localhost:3001';
const cookieJar = new Map();

function parseSetCookieLine(line) {
  const firstPart = line.split(';', 1)[0] || '';
  const separatorIndex = firstPart.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const name = firstPart.slice(0, separatorIndex).trim();
  const value = firstPart.slice(separatorIndex + 1).trim();

  return { name, value };
}

function getSetCookieValues(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const fallback = headers.get('set-cookie');
  return fallback ? [fallback] : [];
}

function updateCookieJar(response) {
  for (const line of getSetCookieValues(response.headers)) {
    const parsed = parseSetCookieLine(line);

    if (!parsed) {
      continue;
    }

    cookieJar.set(parsed.name, parsed.value);
  }
}

function cookieHeaderValue() {
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function requestJson(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = {
    accept: 'application/json',
    ...headers,
  };

  const cookieValue = cookieHeaderValue();
  if (cookieValue) {
    requestHeaders.cookie = cookieValue;
  }

  if (body !== undefined) {
    requestHeaders['content-type'] = 'application/json';
  }

  const response = await fetchApi(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  updateCookieJar(response);

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} falhou com HTTP ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }

  return payload;
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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

main().catch((error) => {
  consoleApi.error(`[error] ${error.message}`);
  process.exitCode = 1;
});
