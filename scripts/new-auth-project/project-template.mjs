import path from 'node:path';
import { readFile, writeFile, stat, rm } from 'node:fs/promises';

const defaultDependencyVersions = {
  bcryptjs: '^3.0.3',
  'cookie-parser': '^1.4.7',
  jsonwebtoken: '^9.0.3',
  'express-rate-limit': '^8.3.2',
  lowdb: '^7.0.1',
  '@prisma/client': '^6.19.3',
  prisma: '6.19.3',
  nodemailer: '^6.10.1',
  graphql: '^16.11.0',
  '@apollo/server': '^4.12.2',
  '@as-integrations/express5': '^1.1.2',
};

const defaultDevDependencyVersions = {
  '@types/cookie-parser': '^1.4.9',
  '@types/jsonwebtoken': '^9.0.10',
};

function hasAuthFeature(featureSet) {
  return featureSet === 'auth' || featureSet === 'both';
}

function hasEmailFeature(featureSet) {
  return featureSet === 'email' || featureSet === 'both';
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function ensureDependencyField(packageJson, section, name, fallbackVersion) {
  packageJson[section] = ensureObject(packageJson[section]);

  if (!packageJson[section][name]) {
    packageJson[section][name] = fallbackVersion;
  }
}

function removeDependencyEverywhere(packageJson, name) {
  if (packageJson.dependencies) {
    delete packageJson.dependencies[name];
  }

  if (packageJson.devDependencies) {
    delete packageJson.devDependencies[name];
  }
}

function buildDynamicDescription(projectName, options) {
  const parts = [options.apiStyle, options.architecture, options.database, options.language].filter(Boolean);
  const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `${projectName} generated with StackForge${suffix}`;
}

function buildDynamicKeywords(projectName, options) {
  const keywords = new Set(['stackforge', 'api', 'express', options.language, options.architecture, options.apiStyle, options.database]);

  if (hasAuthFeature(options.featureSet)) {
    keywords.add('auth');
    keywords.add('jwt');
  }

  if (hasEmailFeature(options.featureSet)) {
    keywords.add('email');
  }

  if (options.database === 'json') {
    keywords.add('lowdb');
  } else {
    keywords.add('prisma');
  }

  if (options.apiStyle === 'graphql' || options.apiStyle === 'hybrid') {
    keywords.add('graphql');
  }

  for (const token of projectName.toLowerCase().split(/[^a-z0-9]+/g)) {
    if (token) {
      keywords.add(token);
    }
  }

  return Array.from(keywords);
}

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

export async function finalizeGeneratedPackageJson(destinationProjectDir, options) {
  const packageJsonPath = path.join(destinationProjectDir, 'package.json');
  const packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  const authEnabled = hasAuthFeature(options.featureSet);
  const emailEnabled = hasEmailFeature(options.featureSet);
  const graphQlEnabled = options.apiStyle === 'graphql' || options.apiStyle === 'hybrid';
  const prismaEnabled = options.database !== 'json';
  const rateLimitingEnabled = Boolean(options.rateLimitingEnabled ?? authEnabled);

  packageJson.name = options.projectName;
  packageJson.description = buildDynamicDescription(options.projectName, options);
  packageJson.keywords = buildDynamicKeywords(options.projectName, options);

  packageJson.scripts = ensureObject(packageJson.scripts);
  packageJson.dependencies = ensureObject(packageJson.dependencies);
  packageJson.devDependencies = ensureObject(packageJson.devDependencies);

  for (const scriptName of ['test:scaffold:readme', 'test:scaffold:arch-api', 'test:scaffold:full-runtime']) {
    delete packageJson.scripts[scriptName];
  }

  if (!prismaEnabled) {
    for (const scriptName of ['prisma:generate', 'prisma:migrate', 'prisma:deploy', 'prisma:push', 'prisma:bootstrap']) {
      delete packageJson.scripts[scriptName];
    }
  }

  if (authEnabled) {
    ensureDependencyField(packageJson, 'dependencies', 'bcryptjs', defaultDependencyVersions.bcryptjs);
    ensureDependencyField(packageJson, 'dependencies', 'cookie-parser', defaultDependencyVersions['cookie-parser']);
    ensureDependencyField(packageJson, 'dependencies', 'jsonwebtoken', defaultDependencyVersions.jsonwebtoken);

    if (options.language === 'typescript') {
      ensureDependencyField(packageJson, 'devDependencies', '@types/cookie-parser', defaultDevDependencyVersions['@types/cookie-parser']);
      ensureDependencyField(packageJson, 'devDependencies', '@types/jsonwebtoken', defaultDevDependencyVersions['@types/jsonwebtoken']);
    }
  } else {
    removeDependencyEverywhere(packageJson, 'bcryptjs');
    removeDependencyEverywhere(packageJson, 'cookie-parser');
    removeDependencyEverywhere(packageJson, 'jsonwebtoken');
    removeDependencyEverywhere(packageJson, '@types/cookie-parser');
    removeDependencyEverywhere(packageJson, '@types/jsonwebtoken');
  }

  if (rateLimitingEnabled) {
    ensureDependencyField(packageJson, 'dependencies', 'express-rate-limit', defaultDependencyVersions['express-rate-limit']);
  } else {
    removeDependencyEverywhere(packageJson, 'express-rate-limit');
  }

  if (options.database === 'json') {
    ensureDependencyField(packageJson, 'dependencies', 'lowdb', defaultDependencyVersions.lowdb);
    removeDependencyEverywhere(packageJson, '@prisma/client');
    removeDependencyEverywhere(packageJson, 'prisma');
  } else {
    removeDependencyEverywhere(packageJson, 'lowdb');
    ensureDependencyField(packageJson, 'dependencies', '@prisma/client', defaultDependencyVersions['@prisma/client']);
    ensureDependencyField(packageJson, 'dependencies', 'prisma', defaultDependencyVersions.prisma);
  }

  if (emailEnabled) {
    ensureDependencyField(packageJson, 'dependencies', 'nodemailer', defaultDependencyVersions.nodemailer);
  } else {
    removeDependencyEverywhere(packageJson, 'nodemailer');
  }

  if (graphQlEnabled) {
    ensureDependencyField(packageJson, 'dependencies', 'graphql', defaultDependencyVersions.graphql);
    ensureDependencyField(packageJson, 'dependencies', '@apollo/server', defaultDependencyVersions['@apollo/server']);
    ensureDependencyField(packageJson, 'dependencies', '@as-integrations/express5', defaultDependencyVersions['@as-integrations/express5']);
  } else {
    removeDependencyEverywhere(packageJson, 'graphql');
    removeDependencyEverywhere(packageJson, '@apollo/server');
    removeDependencyEverywhere(packageJson, '@as-integrations/express5');
  }

  removeDependencyEverywhere(packageJson, 'archiver');

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
