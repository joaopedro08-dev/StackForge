import { fetchApi } from './runtime.mjs';

export async function getJson(url) {
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

export function createCookieJsonClient(baseUrl, fetchFn) {
  const cookieJar = new Map();

  function updateCookieJar(response) {
    for (const line of getSetCookieValues(response.headers)) {
      const parsed = parseSetCookieLine(line);
      if (parsed) {
        cookieJar.set(parsed.name, parsed.value);
      }
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

    const response = await fetchFn(`${baseUrl}${path}`, {
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
      throw new Error(
        `${method} ${path} falhou com HTTP ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
      );
    }

    return payload;
  }

  return {
    requestJson,
    cookieJar,
  };
}
