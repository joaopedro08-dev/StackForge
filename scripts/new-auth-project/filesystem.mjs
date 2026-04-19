import path from 'node:path';
import { mkdir, readdir, stat, copyFile, unlink } from 'node:fs/promises';
import { nestedIgnorePaths, rootDir } from './constants.mjs';

export function isIgnoredPath(relativePath) {
  const normalized = path.normalize(relativePath);
  for (const ignoredPath of nestedIgnorePaths) {
    if (normalized === ignoredPath || normalized.startsWith(`${ignoredPath}${path.sep}`)) {
      return true;
    }
  }

  return false;
}

export async function copyDirectoryRecursive(sourceDir, destinationDir, relativeRoot) {
  await mkdir(destinationDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    const relativePath = path.join(relativeRoot, entry.name);

    if (isIgnoredPath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, destinationPath, relativePath);
      continue;
    }

    await copyFile(sourcePath, destinationPath);
  }
}

export async function copyPath(relativePath, destinationRoot) {
  const sourcePath = path.join(rootDir, relativePath);
  const destinationPath = path.join(destinationRoot, relativePath);

  const sourceStat = await stat(sourcePath);

  if (sourceStat.isDirectory()) {
    await copyDirectoryRecursive(sourcePath, destinationPath, relativePath);
    return;
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

export async function removeFileIfExists(filePath) {
  const fileStat = await stat(filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    return;
  }

  await unlink(filePath);
}
