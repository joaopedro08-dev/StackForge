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
  const routesDir = path.join(destinationProjectDir, 'src', 'routes');
  const viewsDir = path.join(destinationProjectDir, 'src', 'views');

  await writeFileIfMissing(path.join(controllersDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(modelsDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(routesDir, '.gitkeep'), '');
  await writeFileIfMissing(path.join(viewsDir, '.gitkeep'), '');

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
    path.join(routesDir, 'README.md'),
    `# Routes

Use this folder to compose route modules and attach controllers.

Typical responsibilities:
- define endpoint paths and HTTP methods
- attach middlewares and controllers
- keep route wiring separate from business logic
`,
  );

  await writeFileIfMissing(
    path.join(viewsDir, 'README.md'),
    `# Views

Use this folder for response serializers/presenters.

Typical responsibilities:
- map internal/domain objects to API response shapes
- keep output formatting consistent
- avoid putting business rules in response mappers
`,
  );

  await writeFileIfMissing(
    path.join(controllersDir, 'auth.controller.example.js'),
    `// Example service stub (replace with a real service module import).
async function registerExampleService(payload) {
  return {
    id: 'example-user-id',
    name: payload.name,
    email: String(payload.email ?? '').trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
}

// Example presenter (replace with view/presenter from src/views).
function toUserResponseView(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

// Example controller: parse input, call service and map output.
export async function registerExampleController(req, res, next) {
  try {
    const payload = {
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
    };

    const createdUser = await registerExampleService(payload);

    res.status(201).json({
      user: toUserResponseView(createdUser),
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

  await writeFileIfMissing(
    path.join(routesDir, 'auth.routes.example.js'),
    `// Example route wiring: attach controller and middlewares.
import { Router } from 'express';
import { registerExampleController } from '../controllers/auth.controller.example.js';

const router = Router();

router.post('/auth/register', registerExampleController);

export { router as authExampleRouter };
`,
  );

  await writeFileIfMissing(
    path.join(viewsDir, 'auth.view.example.js'),
    `// Example response mapper used by controllers.
export function toAuthUserView(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
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

async function scaffoldLayeredGuidanceFiles(destinationProjectDir) {
  const modulesDir = path.join(destinationProjectDir, 'src', 'modules');
  const exampleModuleDir = path.join(modulesDir, 'example');
  const repositoriesDir = path.join(destinationProjectDir, 'src', 'repositories');
  const middlewaresDir = path.join(destinationProjectDir, 'src', 'middlewares');
  const utilsDir = path.join(destinationProjectDir, 'src', 'utils');

  await mkdir(exampleModuleDir, { recursive: true });
  await mkdir(repositoriesDir, { recursive: true });
  await mkdir(middlewaresDir, { recursive: true });
  await mkdir(utilsDir, { recursive: true });

  await writeFileIfMissing(
    path.join(modulesDir, 'README.md'),
    `# Modules

Feature modules organized by business flow.

Typical responsibilities:
- keep controllers and services close to the feature they serve
- compose request handling and orchestration within the feature boundary
- delegate persistence to repositories and shared helpers to utilities
`,
  );

  await writeFileIfMissing(
    path.join(exampleModuleDir, 'README.md'),
    `# Example Module

This feature module shows the layered split between controller and service.

Use it as a template when adding a real feature module.
`,
  );

  await writeFileIfMissing(
    path.join(repositoriesDir, 'README.md'),
    `# Repositories

Concrete data access adapters live here.

Keep persistence code isolated from controllers and services.
`,
  );

  await writeFileIfMissing(
    path.join(middlewaresDir, 'README.md'),
    `# Middlewares

Cross-cutting request handling, guards, and transport-level checks.

`,
  );

  await writeFileIfMissing(
    path.join(utilsDir, 'README.md'),
    `# Utils

Shared helpers used across modules, services, and infrastructure.
`,
  );

  await writeFileIfMissing(
    path.join(exampleModuleDir, 'example.controller.example.js'),
    `import { createExampleService } from './example.service.example.js';

// Layered controller example: map request to service input and shape the response.
export async function createExampleController(req, res, next) {
  try {
    const service = createExampleService({ repository: req.context?.exampleRepository });
    const result = await service.create({
      name: req.body?.name,
      email: req.body?.email,
    });

    res.status(201).json({
      user: result,
    });
  } catch (error) {
    next(error);
  }
}
`,
  );

  await writeFileIfMissing(
    path.join(exampleModuleDir, 'example.service.example.js'),
    `import { normalizeExampleEmail } from '../../utils/example.util.example.js';

// Layered service example: orchestrate business flow and repository access.
export function createExampleService({ repository }) {
  return {
    async create(input) {
      const user = {
        id: 'example-user-id',
        name: input.name ?? 'Example User',
        email: normalizeExampleEmail(input.email),
        createdAt: new Date().toISOString(),
      };

      await repository.save(user);
      return user;
    },
  };
}
`,
  );

  await writeFileIfMissing(
    path.join(repositoriesDir, 'example.repository.example.js'),
    `// Repository example: isolate persistence details from the service layer.
export function createExampleRepository(dbClient) {
  return {
    async save(user) {
      await dbClient.users.insert(user);
    },
  };
}
`,
  );

  await writeFileIfMissing(
    path.join(middlewaresDir, 'example.middleware.example.js'),
    `// Middleware example: attach feature-specific context before the controller runs.
export function exampleRequestContext(req, _res, next) {
  req.context = {
    ...(req.context ?? {}),
    exampleFeature: true,
  };

  next();
}
`,
  );

  await writeFileIfMissing(
    path.join(utilsDir, 'example.util.example.js'),
    `// Shared helper example used by the layered service.
export function normalizeExampleEmail(value) {
  return String(value ?? '').trim().toLowerCase();
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

Example layering guide:
- src/modules/example for controller + service orchestration
- src/repositories for persistence adapters
- src/middlewares for request guards and context
- src/utils for shared helpers
`;
}

export async function configureGeneratedArchitecture(destinationProjectDir, architecture) {
  const architectureDirsByType = {
    mvc: ['src/models', 'src/views', 'src/controllers', 'src/config', 'src/middlewares', 'src/routes', 'src/utils'],
    clean: ['src/domain', 'src/application', 'src/infrastructure', 'src/interfaces/http'],
    layered: ['src/modules', 'src/modules/example', 'src/repositories', 'src/middlewares', 'src/utils'],
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

  if (architecture === 'layered') {
    await scaffoldLayeredGuidanceFiles(destinationProjectDir);
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
