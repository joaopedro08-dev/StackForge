import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../scripts/new-auth-project/cli.mjs';

describe('parseCliArgs', () => {
  it('parses package manager and feature set options', () => {
    const result = parseCliArgs([
      'my-api',
      '--pm=npm',
      '--features=both',
      '--lang=typescript',
      '--db=postgresql',
      '--architecture=clean',
      '--api=graphql',
      '--full',
    ]);

    expect(result).toMatchObject({
      projectName: 'my-api',
      profile: 'full',
      language: 'typescript',
      database: 'postgresql',
      architecture: 'clean',
      apiStyle: 'graphql',
      packageManager: 'npm',
      featureSet: 'both',
    });
  });

  it('uses defaults for package manager and feature set', () => {
    const result = parseCliArgs(['my-api']);

    expect(result).toMatchObject({
      packageManager: 'pnpm',
      featureSet: 'auth',
    });
  });

  it('throws on invalid package manager', () => {
    expect(() => parseCliArgs(['my-api', '--pm=invalid'])).toThrow('Invalid package manager');
  });

  it('accepts bun and yarn package managers', () => {
    const bunResult = parseCliArgs(['my-api', '--pm=bun']);
    const yarnResult = parseCliArgs(['my-api', '--pm=yarn']);

    expect(bunResult.packageManager).toBe('bun');
    expect(yarnResult.packageManager).toBe('yarn');
  });

  it('throws on invalid feature set', () => {
    expect(() => parseCliArgs(['my-api', '--features=unknown'])).toThrow('Invalid feature set');
  });

  it('accepts common aliases for name, database, package manager and feature set', () => {
    const result = parseCliArgs([
      '--name=my-api',
      '--database=postgresql',
      '--package-manager=yarn',
      '--feature-set=both',
      '--architecture=layered',
      '--api=rest',
    ]);

    expect(result).toMatchObject({
      projectName: 'my-api',
      database: 'postgresql',
      packageManager: 'yarn',
      featureSet: 'both',
      architecture: 'layered',
      apiStyle: 'rest',
    });
  });

  it('throws on unknown flag to avoid silent wrong project generation', () => {
    expect(() => parseCliArgs(['my-api', '--unknown=value'])).toThrow('Unknown option');
  });

  it('throws when an extra positional argument is provided', () => {
    expect(() => parseCliArgs(['my-api', 'extra'])).toThrow('Unexpected argument');
  });
});
