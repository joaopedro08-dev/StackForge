import path from 'node:path';
import { readFile, writeFile, stat, rm } from 'node:fs/promises';

export async function customizeGeneratedPackageJson(destinationProjectDir, projectName) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  packageJson.name = projectName;

  if (packageJson.scripts) {
    for (const scriptName of Object.keys(packageJson.scripts)) {
      if (scriptName.startsWith('prod:') || scriptName.startsWith('perf:')) {
        delete packageJson.scripts[scriptName];
      }
    }
  }

  if (packageJson.scripts && packageJson.scripts['dev:new-project']) {
    delete packageJson.scripts['dev:new-project'];
  }

  if (packageJson.scripts && packageJson.scripts['test:scaffold:db']) {
    delete packageJson.scripts['test:scaffold:db'];
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

export async function normalizeDockerfileStartCommand(destinationProjectDir) {
  const dockerfilePath = path.join(destinationProjectDir, 'Dockerfile');
  const dockerfileStat = await stat(dockerfilePath).catch(() => null);

  if (!dockerfileStat?.isFile()) {
    return;
  }

  const dockerfileRaw = await readFile(dockerfilePath, 'utf8');
  const dockerfileUpdated = dockerfileRaw.replace(
    /CMD\s+\["sh",\s*"-c",\s*"pnpm prisma:bootstrap && (?:node index\.(?:js|ts)|pnpm start)"\]/,
    'CMD ["sh", "-c", "pnpm prisma:bootstrap && pnpm start"]',
  );

  if (dockerfileUpdated !== dockerfileRaw) {
    await writeFile(dockerfilePath, dockerfileUpdated, 'utf8');
  }
}

export async function removeGeneratedScaffoldRuntime(destinationProjectDir) {
  const appCandidates = [path.join(destinationProjectDir, 'src', 'app.js'), path.join(destinationProjectDir, 'src', 'app.ts')];

  for (const appPath of appCandidates) {
    const appStat = await stat(appPath).catch(() => null);

    if (!appStat?.isFile()) {
      continue;
    }

    const appRaw = await readFile(appPath, 'utf8');
    const appUpdated = appRaw
      .replace(/^import path from 'node:path';\r?\n/m, '')
      .replace(/^import \{ initializeDownloadsManager \} from '\.\/modules\/scaffold\/downloads-manager\.js';\r?\n/m, '')
      .replace(/^import \{ scaffoldRouter \} from '\.\/modules\/scaffold\/scaffold\.routes\.js';\r?\n/m, '')
      .replace(/^\s*\/\/ Initialize downloads manager\r?\n/m, '')
      .replace(/^\s*const downloadsDir = path\.resolve\(process\.cwd\(\), 'web', 'public', 'downloads'\);\r?\n/m, '')
      .replace(/^\s*initializeDownloadsManager\(downloadsDir\);\r?\n/m, '')
      .replace(/^\s*app\.locals\.downloadsDir = downloadsDir;\r?\n/m, '')
      .replace(/^[ \t]*app\.use\('\/api\/scaffold', scaffoldRouter\);\r?\n/m, '');

    if (appUpdated !== appRaw) {
      await writeFile(appPath, appUpdated, 'utf8');
    }
  }

  await rm(path.join(destinationProjectDir, 'src', 'modules', 'scaffold'), {
    recursive: true,
    force: true,
  });
}
