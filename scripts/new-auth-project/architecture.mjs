import path from 'node:path';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';

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
