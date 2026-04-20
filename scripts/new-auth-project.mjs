import process from 'node:process';
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import { collectInteractiveOptions, parseCliArgs, sanitizeProjectName } from './new-auth-project/cli.mjs';
import {
  consoleApi,
  optionalTopLevelPathsToCopy,
  projectsRootDir,
  topLevelPathsToCopyByProfile,
} from './new-auth-project/constants.mjs';
import { copyPath } from './new-auth-project/filesystem.mjs';
import {
  customizeGeneratedPackageJson,
  finalizeGeneratedPackageJson,
  normalizeDockerfileStartCommand,
  removeGeneratedScaffoldRuntime,
} from './new-auth-project/project-template.mjs';
import { configureGeneratedDatabase } from './new-auth-project/database.mjs';
import { configureGeneratedArchitecture, normalizeGeneratedMvcStructure } from './new-auth-project/architecture.mjs';
import { configureGeneratedApiStyle } from './new-auth-project/api-style.mjs';
import { applyJavaScriptPreset, applyTypeScriptPreset } from './new-auth-project/language-presets.mjs';
import { configureGeneratedPackageManager } from './new-auth-project/package-manager.mjs';
import { configureGeneratedFeatures } from './new-auth-project/features.mjs';
import { updateGeneratedReadmeSummary } from './new-auth-project/readme.mjs';
import { getErrorMessage, runScaffoldStep } from './new-auth-project/scaffold-utils.mjs';

// Orchestrates the full scaffold pipeline for a new generated project.
async function main() {
  const parsedOptions = parseCliArgs(process.argv.slice(2));
  const resolvedOptions =
    parsedOptions.interactive || !parsedOptions.projectName
      ? await collectInteractiveOptions(parsedOptions)
      : parsedOptions;

  if (resolvedOptions.canceled) {
    consoleApi.log('[info] Project creation canceled by user.');
    return;
  }

  const {
    profile,
    language,
    database,
    architecture,
    apiStyle,
    packageManager,
    featureSet,
    projectName: rawProjectName,
  } = resolvedOptions;

  if (!rawProjectName) {
    consoleApi.error(
      'Usage: pnpm dev:new-project -- <project-name> [--full] [--lang=javascript|typescript] [--db=json|postgresql|mysql|sqlite|sqlserver] [--architecture=layered|mvc|clean] [--api=rest|graphql|hybrid] [--pm=pnpm|npm|yarn|bun] [--features=auth|email|both|none] [--interactive]',
    );
    process.exitCode = 1;
    return;
  }

  const projectName = sanitizeProjectName(rawProjectName);

  if (!projectName) {
    consoleApi.error('Invalid project name. Use letters, numbers, - or _.');
    process.exitCode = 1;
    return;
  }

  const destinationProjectDir = path.join(projectsRootDir, projectName);

  await runScaffoldStep('prepare_projects_directory', async () => {
    await mkdir(projectsRootDir, { recursive: true });
  });

  try {
    await stat(destinationProjectDir);
    consoleApi.error(`Project directory already exists: ${destinationProjectDir}`);
    process.exitCode = 1;
    return;
  } catch {
    // Destination does not exist, continue.
  }

  await runScaffoldStep('create_project_directory', async () => {
    await mkdir(destinationProjectDir, { recursive: true });
  });

  const topLevelPathsToCopy = topLevelPathsToCopyByProfile[profile];

  if (!topLevelPathsToCopy) {
    consoleApi.error(`Invalid profile received: ${profile}`);
    process.exitCode = 1;
    return;
  }

  await runScaffoldStep('copy_template_files', async () => {
    // Copy the selected template profile and tolerate optional files missing in container/runtime variants.
    for (const relativePath of topLevelPathsToCopy) {
      await runScaffoldStep(`copy:${relativePath}`, async () => {
        try {
          await copyPath(relativePath, destinationProjectDir);
        } catch (error) {
          const isMissingOptionalFile =
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ENOENT' &&
            optionalTopLevelPathsToCopy.has(relativePath);

          if (isMissingOptionalFile) {
            consoleApi.warn(`[warn] Optional template file not found and skipped: ${relativePath}`);
            return;
          }

          throw error;
        }
      });
    }
  });

  await runScaffoldStep('customize_package_json', async () => {
    await customizeGeneratedPackageJson(destinationProjectDir, projectName);
  });

  await runScaffoldStep('normalize_dockerfile_start_command', async () => {
    await normalizeDockerfileStartCommand(destinationProjectDir);
  });

  await runScaffoldStep('remove_internal_scaffold_runtime', async () => {
    await removeGeneratedScaffoldRuntime(destinationProjectDir);
  });

  await runScaffoldStep(`configure_database:${database}`, async () => {
    await configureGeneratedDatabase(destinationProjectDir, database);
  });

  await runScaffoldStep(`configure_architecture:${architecture}`, async () => {
    await configureGeneratedArchitecture(destinationProjectDir, architecture);
  });

  await runScaffoldStep(`configure_api_style:${apiStyle}`, async () => {
    await configureGeneratedApiStyle(destinationProjectDir, apiStyle);
  });

  await runScaffoldStep(`apply_language_preset:${language}`, async () => {
    if (language === 'typescript') {
      await applyTypeScriptPreset(destinationProjectDir);
      return;
    }

    await applyJavaScriptPreset(destinationProjectDir);
  });

  await runScaffoldStep(`configure_features:${featureSet}`, async () => {
    await configureGeneratedFeatures(destinationProjectDir, featureSet, apiStyle);
  });

  await runScaffoldStep('normalize_mvc_structure', async () => {
    if (architecture === 'mvc') {
      await normalizeGeneratedMvcStructure(destinationProjectDir);
    }
  });

  await runScaffoldStep(`configure_package_manager:${packageManager}`, async () => {
    await configureGeneratedPackageManager(destinationProjectDir, packageManager);
  });

  await runScaffoldStep('finalize_package_json', async () => {
    await finalizeGeneratedPackageJson(destinationProjectDir, {
      projectName,
      language,
      database,
      architecture,
      apiStyle,
      featureSet,
      rateLimitingEnabled: featureSet === 'auth' || featureSet === 'both',
    });
  });

  await runScaffoldStep('update_dynamic_readme_summary', async () => {
    // Persist a summary block so the generated README reflects the chosen options.
    await updateGeneratedReadmeSummary(destinationProjectDir, {
      projectName,
      profile,
      language,
      database,
      architecture,
      apiStyle,
      packageManager,
      featureSet,
    });
  });

  consoleApi.log(`[ok] Project created at: ${destinationProjectDir}`);
  consoleApi.log(`[info] Profile: ${profile}`);
  consoleApi.log(`[info] Language: ${language}`);
  consoleApi.log(`[info] Database: ${database}`);
  consoleApi.log(`[info] Architecture: ${architecture}`);
  consoleApi.log(`[info] API style: ${apiStyle}`);
  consoleApi.log(`[info] Package manager: ${packageManager}`);
  consoleApi.log(`[info] Feature set: ${featureSet}`);
  consoleApi.log('[next] Enter the directory and install dependencies:');
  consoleApi.log(`       cd developers/projects/${projectName}`);
  consoleApi.log(`       ${packageManager} install`);
  consoleApi.log("       node -e \"require('node:fs').copyFileSync('.env.example', '.env')\"");
  consoleApi.log(`       ${packageManager} run dev`);
}

main().catch((error) => {
  consoleApi.error(`[error] Failed to create project: ${getErrorMessage(error)}`);
  consoleApi.error('[hint] Review the step name in brackets above and retry the command.');
  process.exitCode = 1;
});
