import process from 'node:process';
import readline from 'node:readline/promises';
import {
  consoleApi,
  supportedApiStyles,
  supportedArchitectures,
  supportedDatabases,
  supportedFeatureSets,
  supportedPackageManagers,
} from './constants.mjs';

export function sanitizeProjectName(rawName) {
  return rawName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
}

export function parseCliArgs(args) {
  const options = {
    profile: 'lite',
    language: 'javascript',
    database: 'json',
    architecture: 'layered',
    apiStyle: 'rest',
    packageManager: 'pnpm',
    featureSet: 'auth',
    interactive: false,
  };

  let projectName = '';

  for (const arg of args) {
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--full') {
      options.profile = 'full';
      continue;
    }

    if (arg === '--ts' || arg === '--typescript') {
      options.language = 'typescript';
      continue;
    }

    if (arg === '--interactive' || arg === '-i') {
      options.interactive = true;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      const profileValue = arg.slice('--profile='.length).trim();

      if (profileValue === 'lite' || profileValue === 'full') {
        options.profile = profileValue;
        continue;
      }

      throw new Error('Invalid profile. Use --profile=lite or --profile=full.');
    }

    if (arg.startsWith('--lang=')) {
      const langValue = arg.slice('--lang='.length).trim().toLowerCase();

      if (langValue === 'js' || langValue === 'javascript') {
        options.language = 'javascript';
        continue;
      }

      if (langValue === 'ts' || langValue === 'typescript') {
        options.language = 'typescript';
        continue;
      }

      throw new Error('Invalid language. Use --lang=javascript or --lang=typescript.');
    }

    if (arg.startsWith('--db=') || arg.startsWith('--database=')) {
      const dbValue = arg
        .slice(arg.startsWith('--db=') ? '--db='.length : '--database='.length)
        .trim()
        .toLowerCase();

      if (supportedDatabases.includes(dbValue)) {
        options.database = dbValue;
        continue;
      }

      throw new Error('Invalid database. Use --db=json|postgresql|mysql|sqlite|sqlserver.');
    }

    if (arg.startsWith('--architecture=')) {
      const architectureValue = arg.slice('--architecture='.length).trim().toLowerCase();

      if (supportedArchitectures.includes(architectureValue)) {
        options.architecture = architectureValue;
        continue;
      }

      throw new Error('Invalid architecture. Use --architecture=layered|mvc|clean.');
    }

    if (arg.startsWith('--api=')) {
      const apiValue = arg.slice('--api='.length).trim().toLowerCase();

      if (supportedApiStyles.includes(apiValue)) {
        options.apiStyle = apiValue;
        continue;
      }

      throw new Error('Invalid API style. Use --api=rest|graphql|hybrid.');
    }

    if (arg.startsWith('--pm=') || arg.startsWith('--package-manager=')) {
      const packageManagerValue = arg
        .slice(arg.startsWith('--pm=') ? '--pm='.length : '--package-manager='.length)
        .trim()
        .toLowerCase();

      if (supportedPackageManagers.includes(packageManagerValue)) {
        options.packageManager = packageManagerValue;
        continue;
      }

      throw new Error('Invalid package manager. Use --pm=pnpm|npm|yarn|bun.');
    }

    if (arg.startsWith('--features=') || arg.startsWith('--feature-set=')) {
      const featureSetValue = arg
        .slice(arg.startsWith('--features=') ? '--features='.length : '--feature-set='.length)
        .trim()
        .toLowerCase();

      if (supportedFeatureSets.includes(featureSetValue)) {
        options.featureSet = featureSetValue;
        continue;
      }

      throw new Error('Invalid feature set. Use --features=auth|email|both|none.');
    }

    if (arg.startsWith('--name=') || arg.startsWith('--project-name=')) {
      const projectNameValue = arg.slice(arg.startsWith('--name=') ? '--name='.length : '--project-name='.length).trim();

      if (!projectNameValue) {
        throw new Error('Invalid project name. Use --name=<project-name>.');
      }

      if (projectName) {
        throw new Error('Project name already defined. Provide it once as positional value or with --name=.');
      }

      projectName = projectNameValue;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (!projectName) {
      projectName = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    ...options,
    projectName,
  };
}

function resolveChoiceInput(rawValue, choices) {
  const value = rawValue.trim().toLowerCase();

  if (!value) {
    return null;
  }

  const numericChoice = Number.parseInt(value, 10);
  if (!Number.isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= choices.length) {
    return choices[numericChoice - 1].value;
  }

  const namedChoice = choices.find((choice) => choice.value === value || choice.aliases?.includes(value));
  if (namedChoice) {
    return namedChoice.value;
  }

  return null;
}

async function askChoice(rl, promptLabel, choices, defaultValue) {
  while (true) {
    const defaultChoiceIndex = choices.findIndex((choice) => choice.value === defaultValue);
    const defaultChoiceLabel = defaultChoiceIndex >= 0 ? String(defaultChoiceIndex + 1) : defaultValue;

    consoleApi.log(`\n${promptLabel}`);
    for (let index = 0; index < choices.length; index += 1) {
      const choice = choices[index];
      consoleApi.log(`  ${index + 1}) ${choice.label}`);
    }

    const answer = (await rl.question(`Select an option (default: ${defaultChoiceLabel}): `)).trim();

    if (!answer) {
      return defaultValue;
    }

    const resolved = resolveChoiceInput(answer, choices);
    if (resolved) {
      return resolved;
    }

    consoleApi.error('Invalid option. Type the number or value shown above.');
  }
}

async function askConfirmation(rl, selectedOptions) {
  while (true) {
    consoleApi.log('\nReview your selection:');
    consoleApi.log(`  Project name: ${selectedOptions.projectName}`);
    consoleApi.log(`  Profile: ${selectedOptions.profile}`);
    consoleApi.log(`  Language: ${selectedOptions.language}`);
    consoleApi.log(`  Database: ${selectedOptions.database}`);
    consoleApi.log(`  Architecture: ${selectedOptions.architecture}`);
    consoleApi.log(`  API style: ${selectedOptions.apiStyle}`);
    consoleApi.log(`  Package manager: ${selectedOptions.packageManager}`);
    consoleApi.log(`  Feature set: ${selectedOptions.featureSet}`);

    const answer = (await rl.question('Proceed with project creation? (y/N): ')).trim().toLowerCase();

    if (!answer || answer === 'n' || answer === 'no') {
      return false;
    }

    if (answer === 'y' || answer === 'yes') {
      return true;
    }

    consoleApi.error('Invalid option. Type y or n.');
  }
}

export async function collectInteractiveOptions(initialOptions, dependencies = {}) {
  const createInterface = dependencies.createInterface || readline.createInterface;
  const input = dependencies.input || process.stdin;
  const output = dependencies.output || process.stdout;

  const rl = createInterface({
    input,
    output,
  });

  try {
    consoleApi.log('StackForge Project Scaffolder (interactive mode)');

    let projectName = initialOptions.projectName ?? '';
    while (!projectName.trim()) {
      projectName = await rl.question('Project name: ');

      if (!projectName.trim()) {
        consoleApi.error('Project name is required.');
      }
    }

    const profile = await askChoice(
      rl,
      'Project profile',
      [
        { value: 'lite', label: 'lite - smaller project with faster startup', aliases: ['l'] },
        { value: 'full', label: 'full - includes docs, tests and CI', aliases: ['f'] },
      ],
      initialOptions.profile,
    );

    const language = await askChoice(
      rl,
      'Project language',
      [
        { value: 'javascript', label: 'javascript', aliases: ['js'] },
        { value: 'typescript', label: 'typescript', aliases: ['ts'] },
      ],
      initialOptions.language,
    );

    const database = await askChoice(
      rl,
      'Database provider',
      [
        { value: 'json', label: 'json - local file (no Prisma)', aliases: ['none', 'lowdb'] },
        { value: 'postgresql', label: 'postgresql - Prisma relational provider', aliases: ['postgres', 'pg'] },
        { value: 'mysql', label: 'mysql - Prisma relational provider', aliases: ['my'] },
        { value: 'sqlite', label: 'sqlite - Prisma relational provider', aliases: ['sq'] },
        { value: 'sqlserver', label: 'sqlserver - Prisma relational provider', aliases: ['mssql', 'sql'] },
      ],
      initialOptions.database,
    );

    const architecture = await askChoice(
      rl,
      'Architecture',
      [
        { value: 'layered', label: 'layered - services/repositories/modules (current default)', aliases: ['layers'] },
        { value: 'mvc', label: 'mvc - model/view/controller folders scaffolded', aliases: ['model-view-controller'] },
        { value: 'clean', label: 'clean - domain/application/infrastructure/interfaces scaffolded', aliases: ['hexagonal'] },
      ],
      initialOptions.architecture,
    );

    const apiStyle = await askChoice(
      rl,
      'API style',
      [
        { value: 'rest', label: 'rest - classic REST endpoints', aliases: ['rest-api'] },
        { value: 'graphql', label: 'graphql - GraphQL endpoint scaffold', aliases: ['gql'] },
        { value: 'hybrid', label: 'hybrid - REST + GraphQL together', aliases: ['both'] },
      ],
      initialOptions.apiStyle,
    );

    const packageManager = await askChoice(
      rl,
      'Package manager',
      [
        { value: 'pnpm', label: 'pnpm - faster workspace-friendly installs', aliases: ['p'] },
        { value: 'npm', label: 'npm - default Node.js package manager', aliases: ['n'] },
        { value: 'yarn', label: 'yarn - classic package manager workflow', aliases: ['y'] },
        { value: 'bun', label: 'bun - fast JavaScript runtime and package manager', aliases: ['b'] },
      ],
      initialOptions.packageManager,
    );

    const featureSet = await askChoice(
      rl,
      'Feature set',
      [
        { value: 'auth', label: 'auth - authentication scaffold only', aliases: ['a'] },
        { value: 'email', label: 'email - email configuration scaffold only', aliases: ['e'] },
        { value: 'both', label: 'both - authentication + email configuration', aliases: ['all'] },
        { value: 'none', label: 'none - health/docs baseline only', aliases: ['minimal'] },
      ],
      initialOptions.featureSet,
    );

    const selectedOptions = {
      ...initialOptions,
      projectName: projectName.trim(),
      profile,
      language,
      database,
      architecture,
      apiStyle,
      packageManager,
      featureSet,
    };

    const isConfirmed = await askConfirmation(rl, selectedOptions);
    if (!isConfirmed) {
      return {
        ...selectedOptions,
        canceled: true,
      };
    }

    return selectedOptions;
  } finally {
    rl.close();
  }
}
