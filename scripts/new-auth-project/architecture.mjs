import path from 'node:path';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';

async function writeFileIfMissing(filePath, content) {
  const fileStat = await stat(filePath).catch(() => null);
  if (fileStat?.isFile()) {
    return;
  }

  await writeFile(filePath, content, 'utf8');
}

async function scaffoldMvcGuidanceFiles(destinationProjectDir) {
  const controllersDir = path.join(destinationProjectDir, 'src', 'controllers');
  const modelsDir = path.join(destinationProjectDir, 'src', 'models');

  await writeFileIfMissing(path.join(controllersDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(modelsDir, '.gitkeep'), '');

  await writeFileIfMissing(
    path.join(controllersDir, 'README.md'),
    `# Controllers

Use this folder for HTTP handlers.

Typical responsibilities:
- validate and normalize request data
- call services/use-cases
- map domain output to HTTP response
`,
  );

  await writeFileIfMissing(
    path.join(modelsDir, 'README.md'),
    `# Models

Use this folder for domain entities and validation helpers.

Typical responsibilities:
- model shape and invariants
- normalization helpers
- domain-level transformations
`,
  );

  await writeFileIfMissing(
    path.join(controllersDir, 'auth.controller.example.js'),
    `// Example controller: adapt this shape for real endpoints.
export async function registerExampleController(_req, res, next) {
  try {
    res.status(200).json({
      message: 'Controller example. Replace with your register flow.',
    });
  } catch (error) {
    next(error);
  }
}
`,
  );

  await writeFileIfMissing(
    path.join(modelsDir, 'user.model.example.js'),
    `// Example model helper: keep domain shaping logic here.
export function createUserModel(input = {}) {
  return {
    id: input.id ?? 'example-user-id',
    name: input.name ?? 'Example User',
    email: String(input.email ?? '').trim().toLowerCase(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
`,
  );
}

async function scaffoldCleanGuidanceFiles(destinationProjectDir) {
  const domainDir = path.join(destinationProjectDir, 'src', 'domain');
  const applicationDir = path.join(destinationProjectDir, 'src', 'application');
  const infrastructureDir = path.join(destinationProjectDir, 'src', 'infrastructure');
  const interfacesHttpDir = path.join(destinationProjectDir, 'src', 'interfaces', 'http');

  await writeFileIfMissing(path.join(domainDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(applicationDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(infrastructureDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(interfacesHttpDir, '.gitkeep'), '');

  await writeFileIfMissing(
    path.join(domainDir, 'README.md'),
    `# Domain

Core entities and business rules.

Keep this layer framework-agnostic.
`,
  );

  await writeFileIfMissing(
    path.join(applicationDir, 'README.md'),
    `# Application

Use cases and orchestration logic.

This layer coordinates domain operations and external ports.
`,
  );

  await writeFileIfMissing(
    path.join(infrastructureDir, 'README.md'),
    `# Infrastructure

Adapters for external systems (database, cache, APIs, email, queues).

Map external details to application/domain contracts here.
`,
  );

  await writeFileIfMissing(
    path.join(interfacesHttpDir, 'README.md'),
    `# HTTP Interface

Controllers, route handlers, and request/response mapping for HTTP.

Keep transport concerns here; delegate business rules to application use cases.
`,
  );

  await writeFileIfMissing(
    path.join(domainDir, 'user.entity.example.js'),
    `// Domain entity example: validate invariants here.
export function createUserEntity(input = {}) {
  const email = String(input.email ?? '').trim().toLowerCase();

  if (!email) {
    throw new Error('email is required');
  }

  return {
    id: input.id ?? 'example-user-id',
    name: input.name ?? 'Example User',
    email,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
`,
  );

  await writeFileIfMissing(
    path.join(applicationDir, 'register-user.use-case.example.js'),
    `// Application use-case example: orchestrate domain + repository ports.
export async function registerUserUseCase(input, dependencies) {
  const { createUserEntity, userRepository } = dependencies;

  const user = createUserEntity(input);
  await userRepository.save(user);

  return user;
}
`,
  );

  await writeFileIfMissing(
    path.join(infrastructureDir, 'user.repository.example.js'),
    `// Infrastructure adapter example: concrete persistence implementation.
export function createUserRepositoryAdapter(dbClient) {
  return {
    async save(user) {
      await dbClient.users.insert(user);
    },
  };
}
`,
  );

  await writeFileIfMissing(
    path.join(interfacesHttpDir, 'auth.controller.example.js'),
    `// HTTP controller example: parse request and delegate to use-case.
export async function registerControllerExample(req, res, next, dependencies) {
  try {
    const user = await dependencies.registerUserUseCase(req.body, dependencies);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}
`,
  );
}

function getArchitectureGuideContent(architecture) {
  if (architecture === 'mvc') {
    return `# MVC Scaffold Guide

Selected architecture: mvc

Folders created:
- src/models
- src/views
- src/controllers
- src/config
- src/middlewares
- src/routes
- src/utils

Recommendation:
- keep transport details in controllers
- keep domain entities and validation in models
- keep serializers/presenters in views
- keep cross-cutting concerns in middlewares
- keep route definitions in routes
- keep shared utilities in utils
`;
  }

  if (architecture === 'clean') {
    return `# Clean Architecture Scaffold Guide

Selected architecture: clean

Folders created:
- src/domain
- src/application
- src/infrastructure
- src/interfaces/http

Recommendation:
- domain: entities and business rules
- application: use cases and orchestration
- infrastructure: database/external adapters
- interfaces/http: controllers and request mapping
`;
  }

  return `# Layered Architecture

Selected architecture: layered

Current default structure already follows layered boundaries:
- modules/controllers/services for feature flow
- repositories for persistence abstraction
- db for adapter and health layers
`;
}

export async function configureGeneratedArchitecture(destinationProjectDir, architecture) {
  const architectureDirsByType = {
    mvc: ['src/models', 'src/views', 'src/controllers', 'src/config', 'src/middlewares', 'src/routes', 'src/utils'],
    clean: ['src/domain', 'src/application', 'src/infrastructure', 'src/interfaces/http'],
    layered: [],
  };

  const directoriesToCreate = architectureDirsByType[architecture] || [];
  for (const relativeDir of directoriesToCreate) {
    await mkdir(path.join(destinationProjectDir, relativeDir), { recursive: true });
  }

  const docsDirPath = path.join(destinationProjectDir, 'docs');
  await mkdir(docsDirPath, { recursive: true });
  await writeFile(path.join(docsDirPath, 'architecture.md'), getArchitectureGuideContent(architecture), 'utf8');

  if (architecture === 'mvc') {
    await scaffoldMvcGuidanceFiles(destinationProjectDir);
  }

  if (architecture === 'clean') {
    await scaffoldCleanGuidanceFiles(destinationProjectDir);
  }
}

async function listSourceFilesRecursively(dirPath) {
  const dirStat = await stat(dirPath).catch(() => null);
  if (!dirStat?.isDirectory()) {
    return [];
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSourceFilesRecursively(entryPath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      files.push(entryPath);
    }
  }

  return files;
}

async function moveTopLevelFiles(sourceDir, destinationDir) {
  const sourceStat = await stat(sourceDir).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    return;
  }

  await mkdir(destinationDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const fromPath = path.join(sourceDir, entry.name);
    const toPath = path.join(destinationDir, entry.name);

    await rm(toPath, { force: true });
    await rename(fromPath, toPath);
  }
}

async function rewriteImportsForMvc(destinationProjectDir) {
  const srcDir = path.join(destinationProjectDir, 'src');
  const sourceFiles = await listSourceFilesRecursively(srcDir);

  for (const filePath of sourceFiles) {
    const rawContent = await readFile(filePath, 'utf8');
    // Only rewrite docs imports to config, keep middlewares and utils as-is
    const updatedContent = rawContent.replaceAll('/docs/', '/config/');

    if (updatedContent !== rawContent) {
      await writeFile(filePath, updatedContent, 'utf8');
    }
  }
}

async function removeDirIfEmpty(dirPath) {
  const dirStat = await stat(dirPath).catch(() => null);

  if (!dirStat?.isDirectory()) {
    return;
  }

  const entries = await readdir(dirPath).catch(() => []);
  if (entries.length === 0) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

export async function normalizeGeneratedMvcStructure(destinationProjectDir) {
  const srcDir = path.join(destinationProjectDir, 'src');
  const configDir = path.join(srcDir, 'config');
  const docsDir = path.join(srcDir, 'docs');
  const modulesDir = path.join(srcDir, 'modules');

  // For MVC, keep middlewares, routes, and utils folders
  // Only move docs to config
  await moveTopLevelFiles(docsDir, configDir);
  await rewriteImportsForMvc(destinationProjectDir);

  // Clean up only the docs folder (moved to config)
  await rm(docsDir, { recursive: true, force: true });
  // Keep middlewares, utils, and routes for MVC
  await removeDirIfEmpty(modulesDir);
}
