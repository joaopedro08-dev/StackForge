import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectInteractiveOptions } from '../../scripts/new-auth-project/cli.mjs';

function createInterfaceFromAnswers(answers) {
  const queue = [...answers];

  return {
    question: vi.fn(async () => {
      if (queue.length === 0) {
        return '';
      }

      return queue.shift();
    }),
    close: vi.fn(),
  };
}

function createFactory(answers) {
  const rl = createInterfaceFromAnswers(answers);

  return {
    createInterface: () => rl,
    rl,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collectInteractiveOptions', () => {
  it('returns canceled=true when user does not confirm', async () => {
    const { createInterface, rl } = createFactory(['my-api', '', '', '', '', '', '', '', 'n']);

    const result = await collectInteractiveOptions(
      {
        profile: 'lite',
        language: 'javascript',
        database: 'json',
        architecture: 'layered',
        apiStyle: 'rest',
        packageManager: 'pnpm',
        featureSet: 'auth',
      },
      { createInterface },
    );

    expect(result.canceled).toBe(true);
    expect(result.projectName).toBe('my-api');
    expect(rl.close).toHaveBeenCalledOnce();
  });

  it('uses defaults when user presses enter for all options', async () => {
    const { createInterface } = createFactory(['default-api', '', '', '', '', '', '', '', 'y']);

    const result = await collectInteractiveOptions(
      {
        profile: 'full',
        language: 'typescript',
        database: 'postgresql',
        architecture: 'clean',
        apiStyle: 'hybrid',
        packageManager: 'npm',
        featureSet: 'both',
      },
      { createInterface },
    );

    expect(result).toMatchObject({
      projectName: 'default-api',
      profile: 'full',
      language: 'typescript',
      database: 'postgresql',
      architecture: 'clean',
      apiStyle: 'hybrid',
      packageManager: 'npm',
      featureSet: 'both',
    });
  });

  it('re-prompts on invalid options until valid selections are provided', async () => {
    const { createInterface } = createFactory([
      'prompt-api',
      'x',
      '2',
      'wrong',
      '1',
      'invalid-db',
      'mysql',
      'invalid-arch',
      'clean',
      'invalid-api',
      'graphql',
      'invalid-pm',
      'yarn',
      'invalid-feature',
      'email',
      'maybe',
      'yes',
    ]);

    const result = await collectInteractiveOptions(
      {
        profile: 'lite',
        language: 'javascript',
        database: 'json',
        architecture: 'layered',
        apiStyle: 'rest',
        packageManager: 'pnpm',
        featureSet: 'auth',
      },
      { createInterface },
    );

    expect(result).toMatchObject({
      projectName: 'prompt-api',
      profile: 'full',
      language: 'javascript',
      database: 'mysql',
      architecture: 'clean',
      apiStyle: 'graphql',
      packageManager: 'yarn',
      featureSet: 'email',
    });
    expect(result.canceled).toBeUndefined();
  });
});
