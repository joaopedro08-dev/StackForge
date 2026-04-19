import { afterEach, describe, expect, it, vi } from 'vitest';

const originalPostgresHostPort = process.env.POSTGRES_HOST_PORT;

async function loadModule() {
  vi.resetModules();
  return import('../../scripts/production/core/up-options.mjs');
}

afterEach(() => {
  if (originalPostgresHostPort === undefined) {
    delete process.env.POSTGRES_HOST_PORT;
  } else {
    process.env.POSTGRES_HOST_PORT = originalPostgresHostPort;
  }
});

describe('parseUpArgs', () => {
  it('uses default database port from environment', async () => {
    process.env.POSTGRES_HOST_PORT = '60001';
    const { parseUpArgs } = await loadModule();

    const parsed = parseUpArgs([]);

    expect(parsed).toEqual({
      dbPort: '60001',
      skipSmoke: false,
      build: false,
    });
  });

  it('accepts db port by flag and toggles build and skip-smoke', async () => {
    const { parseUpArgs } = await loadModule();

    const parsed = parseUpArgs(['--db-port=55440', '--build', '--skip-smoke']);

    expect(parsed).toEqual({
      dbPort: '55440',
      skipSmoke: true,
      build: true,
    });
  });

  it('accepts numeric positional port', async () => {
    const { parseUpArgs } = await loadModule();

    const parsed = parseUpArgs(['55450']);

    expect(parsed.dbPort).toBe('55450');
  });

  it('throws for invalid argument', async () => {
    const { parseUpArgs } = await loadModule();

    expect(() => parseUpArgs(['--invalid'])).toThrow('Invalid argument: --invalid');
  });

  it('throws for non-numeric database port', async () => {
    const { parseUpArgs } = await loadModule();

    expect(() => parseUpArgs(['--db-port=abc'])).toThrow('Database port must be numeric.');
  });
});
