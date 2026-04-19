import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { runCommand } from '../../scripts/production/core/process-runner.mjs';

function createFakeChildProcess(trigger) {
  const emitter = new EventEmitter();

  queueMicrotask(() => {
    trigger(emitter);
  });

  return emitter;
}

describe('runCommand', () => {
  it('resolves when child exits with code 0', async () => {
    const spawnFn = (command, args, options) => {
      expect(command).toBe('node');
      expect(args).toEqual(['script.js']);
      expect(options.env.TEST_FLAG).toBe('1');

      return createFakeChildProcess((child) => {
        child.emit('close', 0);
      });
    };

    await expect(runCommand('node', ['script.js'], { TEST_FLAG: '1' }, spawnFn)).resolves.toBeUndefined();
  });

  it('rejects when child exits with non-zero code', async () => {
    const spawnFn = () =>
      createFakeChildProcess((child) => {
        child.emit('close', 2);
      });

    await expect(runCommand('node', ['broken.js'], process.env, spawnFn)).rejects.toThrow(
      'Command failed (node broken.js) with exit code 2',
    );
  });

  it('rejects when child emits process error', async () => {
    const spawnFn = () =>
      createFakeChildProcess((child) => {
        child.emit('error', new Error('spawn failed'));
      });

    await expect(runCommand('node', ['missing.js'], process.env, spawnFn)).rejects.toThrow('spawn failed');
  });
});
