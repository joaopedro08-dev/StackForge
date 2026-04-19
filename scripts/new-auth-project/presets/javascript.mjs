import path from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { removeFileIfExists } from '../filesystem.mjs';

export async function applyJavaScriptPreset(destinationProjectDir) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.scripts = packageJson.scripts || {};
  packageJson.devDependencies = packageJson.devDependencies || {};

  if (packageJson.scripts.typecheck) {
    delete packageJson.scripts.typecheck;
  }

  if (packageJson.devDependencies.typescript) {
    delete packageJson.devDependencies.typescript;
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  const vitestConfigMjsPath = path.join(destinationProjectDir, 'vitest.config.mjs');
  const vitestWorkspaceMjsPath = path.join(destinationProjectDir, 'vitest.workspace.mjs');

  const vitestConfigExists = await stat(vitestConfigMjsPath).catch(() => null);
  if (vitestConfigExists?.isFile()) {
    const vitestConfigRaw = await readFile(vitestConfigMjsPath, 'utf8');
    const vitestConfigUpdated = vitestConfigRaw.replace(/tests\/\*\*\/\*\.test\.\{js,ts\}/g, 'tests/**/*.test.js');

    if (vitestConfigUpdated !== vitestConfigRaw) {
      await writeFile(vitestConfigMjsPath, vitestConfigUpdated, 'utf8');
    }
  }

  const vitestWorkspaceExists = await stat(vitestWorkspaceMjsPath).catch(() => null);
  if (vitestWorkspaceExists?.isFile()) {
    const vitestWorkspaceRaw = await readFile(vitestWorkspaceMjsPath, 'utf8');
    const vitestWorkspaceUpdated = vitestWorkspaceRaw.replace('./vitest.config.ts', './vitest.config.mjs');

    if (vitestWorkspaceUpdated !== vitestWorkspaceRaw) {
      await writeFile(vitestWorkspaceMjsPath, vitestWorkspaceUpdated, 'utf8');
    }
  }

  await removeFileIfExists(path.join(destinationProjectDir, 'vitest.config.ts'));
  await removeFileIfExists(path.join(destinationProjectDir, 'vitest.workspace.ts'));
  await removeFileIfExists(path.join(destinationProjectDir, 'tsconfig.json'));
}
