import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import { HttpError } from '../../utils/http-error.js';
import { generateDownloadToken } from './downloads-manager.js';

const scaffoldScriptPath = path.resolve(process.cwd(), 'scripts/new-auth-project.mjs');
const generatedProjectsDir = path.resolve(process.cwd(), 'developers', 'projects');
const downloadsDir = path.resolve(process.cwd(), 'web', 'public', 'downloads');

function normalizeCliLog(value) {
  if (!value) {
    return '';
  }

  return String(value).replace(/\r\n/g, '\n').trim();
}

function toCliArgs(options) {
  const args = [options.projectName];

  if (options.profile === 'full') {
    args.push('--full');
  }

  if (options.language === 'typescript') {
    args.push('--lang=typescript');
  }

  if (options.database !== 'json') {
    args.push(`--db=${options.database}`);
  }

  if (options.architecture !== 'layered') {
    args.push(`--architecture=${options.architecture}`);
  }

  if (options.apiStyle !== 'rest') {
    args.push(`--api=${options.apiStyle}`);
  }

  if (options.packageManager !== 'pnpm') {
    args.push(`--pm=${options.packageManager}`);
  }

  if (options.featureSet !== 'auth') {
    args.push(`--features=${options.featureSet}`);
  }

  return args;
}

export function runScaffoldCreateProject(options) {
  return new Promise((resolve, reject) => {
    const cliArgs = toCliArgs(options);
    const child = spawn(process.execPath, [scaffoldScriptPath, ...cliArgs], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new HttpError(500, `Failed to spawn scaffold process: ${error.message}`));
    });

    child.on('close', (code) => {
      const cleanStdout = normalizeCliLog(stdout);
      const cleanStderr = normalizeCliLog(stderr);

      if (code !== 0) {
        const details = cleanStderr || cleanStdout || 'Unknown scaffold failure.';
        reject(new HttpError(400, details));
        return;
      }

      resolve({
        output: cleanStdout,
        warnings: cleanStderr,
      });
    });
  });
}

function getGeneratedProjectPath(projectName) {
  return path.join(generatedProjectsDir, projectName);
}

async function createProjectZipFile(projectName, sourceDir) {
  try {
    await stat(sourceDir);
  } catch {
    throw new HttpError(500, `Generated project directory not found: ${sourceDir}`);
  }

  // Ensure downloads directory exists
  await mkdir(downloadsDir, { recursive: true });

  const zipFileName = `${projectName}-${Date.now()}.zip`;
  const archivePath = path.join(downloadsDir, zipFileName);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    output.on('close', () => {
      resolve(archivePath);
    });

    output.on('error', (error) => {
      reject(new HttpError(500, `Failed to write ZIP archive: ${error.message}`));
    });

    archive.on('warning', (warning) => {
      console.warn('ZIP archive warning:', warning.message);
    });

    archive.on('error', (error) => {
      reject(new HttpError(500, `Failed to build ZIP archive: ${error.message}`));
    });

    archive.pipe(output);
    archive.directory(sourceDir, projectName);
    archive.finalize();
  });
}

export async function generateProjectArchive(options) {
  const internalProjectName = `${options.projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectDir = getGeneratedProjectPath(internalProjectName);
  const result = await runScaffoldCreateProject({
    ...options,
    projectName: internalProjectName,
  });
  const archivePath = await createProjectZipFile(options.projectName, projectDir);
  const zipFileName = path.basename(archivePath);
  const downloadToken = generateDownloadToken(zipFileName);

  return {
    projectName: options.projectName,
    archivePath,
    downloadToken,
    projectDir,
    output: result.output,
    warnings: result.warnings,
  };
}

export async function cleanupGeneratedArtifacts(artifacts) {
  if (!artifacts || !artifacts.projectDir) {
    return;
  }

  try {
    await rm(artifacts.projectDir, { recursive: true, force: true });
  } catch {
    // Cleanup failures should not break request lifecycle.
  }
}
