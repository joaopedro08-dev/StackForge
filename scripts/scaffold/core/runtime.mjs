import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export function resolveScaffoldContext(importMetaUrl) {
  const currentFilePath = fileURLToPath(importMetaUrl);
  let scriptsDir = path.dirname(currentFilePath);

  while (path.basename(scriptsDir) !== 'scripts') {
    const parentDir = path.dirname(scriptsDir);

    if (parentDir === scriptsDir) {
      throw new Error('Unable to resolve scripts directory from current module path.');
    }

    scriptsDir = parentDir;
  }

  const rootDir = path.resolve(scriptsDir, '..');
  const projectsRootDir = path.join(rootDir, 'developers', 'projects');
  const generatorScriptPath = path.join(scriptsDir, 'new-auth-project.mjs');

  return {
    rootDir,
    projectsRootDir,
    generatorScriptPath,
  };
}

export async function runGenerator(rootDir, generatorScriptPath, args) {
  await execFileAsync(process.execPath, [generatorScriptPath, '--', ...args], {
    cwd: rootDir,
    env: process.env,
  });
}

export function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function formatDurationMs(durationMs) {
  return `${durationMs}ms`;
}

export async function assertFileExists(filePath) {
  await access(filePath);
}

export async function assertFileMissing(filePath) {
  try {
    await access(filePath);
  } catch {
    return;
  }

  throw new Error(`Expected file to be missing: ${filePath}`);
}

export async function readFirstExistingFile(filePaths) {
  for (const filePath of filePaths) {
    try {
      return await readFile(filePath, 'utf8');
    } catch {
      // Continue with next candidate.
    }
  }

  throw new Error(`None of the expected files exists: ${filePaths.join(', ')}`);
}
