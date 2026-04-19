import path from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';

const summaryStartMarker = '<!-- generated-project-summary:start -->';
const summaryEndMarker = '<!-- generated-project-summary:end -->';
const titleMarker = '<!-- generated-title:start -->';
const titleEndMarker = '<!-- generated-title:end -->';

function removeGeneratedSection(readmeContent, startMarker, endMarker) {
  const startIndex = readmeContent.indexOf(startMarker);
  const endIndex = readmeContent.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return readmeContent;
  }

  const afterEndIndex = endIndex + endMarker.length;
  return `${readmeContent.slice(0, startIndex).trimEnd()}\n${readmeContent.slice(afterEndIndex).trimStart()}`;
}

function resolveInstallCommand(packageManager) {
  if (packageManager === 'npm') {
    return 'npm install';
  }

  if (packageManager === 'yarn') {
    return 'yarn install';
  }

  if (packageManager === 'bun') {
    return 'bun install';
  }

  return 'pnpm install';
}

function resolveDevCommand(packageManager) {
  if (packageManager === 'npm') {
    return 'npm run dev';
  }

  if (packageManager === 'yarn') {
    return 'yarn dev';
  }

  if (packageManager === 'bun') {
    return 'bun run dev';
  }

  return 'pnpm dev';
}

function resolveEnabledApis(apiStyle, featureSet) {
  const apiLines = [];

  if (featureSet === 'auth' || featureSet === 'both') {
    if (apiStyle === 'rest' || apiStyle === 'hybrid') {
      apiLines.push('- REST auth endpoints: /auth/*');
    }
  }

  if (apiStyle === 'graphql' || apiStyle === 'hybrid') {
    apiLines.push('- GraphQL endpoint: /graphql');
  }

  if (featureSet === 'email' || featureSet === 'both') {
    apiLines.push('- Email endpoint: /email/send');
  }

  if (apiLines.length === 0) {
    apiLines.push('- Baseline endpoints only: /health, /docs, /openapi.json');
  }

  return apiLines.join('\n');
}

function resolveArchitectureNotes(architecture) {
  if (architecture !== 'mvc') {
    return '';
  }

  return [
    'MVC folder contract:',
    '',
    '- `src/config` - configuration and utilities',
    '- `src/controllers` - HTTP request handlers',
    '- `src/middlewares` - cross-cutting concerns',
    '- `src/models` - domain entities and validation',
    '- `src/routes` - route definitions',
    '- `src/utils` - shared utility functions',
    '- `src/views` - response serializers/presenters',
  ].join('\n');
}

function buildSummaryBlock(options) {
  const installCommand = resolveInstallCommand(options.packageManager);
  const devCommand = resolveDevCommand(options.packageManager);
  const codeFence = '```';
  const architectureNotes = resolveArchitectureNotes(options.architecture);

  return `${summaryStartMarker}

## Generated Project Summary

**Stack:** ${options.architecture.toUpperCase()} + ${options.apiStyle.toUpperCase()} + ${options.database.toUpperCase()} + ${options.packageManager}

Selected options:

- profile: ${options.profile}
- language: ${options.language}
- database: ${options.database}
- architecture: ${options.architecture}
- api style: ${options.apiStyle}
- package manager: ${options.packageManager}
- feature set: ${options.featureSet}

Enabled API surface:

${resolveEnabledApis(options.apiStyle, options.featureSet)}

${architectureNotes ? `${architectureNotes}\n` : ''}

Quick start:

${codeFence}bash
cd developers/projects/${options.projectName}
${installCommand}
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
${devCommand}
${codeFence}

${summaryEndMarker}`;
}

export async function updateGeneratedReadmeSummary(destinationProjectDir, options) {
  const readmePath = path.join(destinationProjectDir, 'README.md');
  const readmeStat = await stat(readmePath).catch(() => null);

  if (!readmeStat?.isFile()) {
    return;
  }

  const readmeRaw = await readFile(readmePath, 'utf8');
  const readmeWithoutSummary = removeGeneratedSection(readmeRaw, summaryStartMarker, summaryEndMarker);
  const summaryBlock = buildSummaryBlock(options);
  const readmeUpdated = `${readmeWithoutSummary.trimEnd()}\n\n${summaryBlock}\n`;

  if (readmeUpdated !== readmeRaw) {
    await writeFile(readmePath, readmeUpdated, 'utf8');
  }
}
