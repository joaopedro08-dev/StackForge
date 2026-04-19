import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { cleanupAllDownloads, removeDownloadFile } from '../src/modules/scaffold/downloads-manager.js';

describe('downloads-manager', () => {
  it('removes a single download file and clears its token entry', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'stackforge-downloads-'));

    try {
      const filename = 'project.zip';
      const filePath = path.join(tempDir, filename);

      await writeFile(filePath, 'zip-bytes', 'utf8');

      const removed = await removeDownloadFile(tempDir, filename);

      expect(removed).toBe(true);
      await expect(readFile(filePath, 'utf8')).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('removes all downloads in a directory', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'stackforge-downloads-all-'));

    try {
      await writeFile(path.join(tempDir, 'one.zip'), 'one', 'utf8');
      await writeFile(path.join(tempDir, 'two.zip'), 'two', 'utf8');

      const deletedCount = await cleanupAllDownloads(tempDir);

      expect(deletedCount).toBe(2);
      await expect(readFile(path.join(tempDir, 'one.zip'), 'utf8')).rejects.toThrow();
      await expect(readFile(path.join(tempDir, 'two.zip'), 'utf8')).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});