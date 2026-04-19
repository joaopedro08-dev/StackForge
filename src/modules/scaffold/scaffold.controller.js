import { createProjectSchema } from './scaffold.schemas.js';
import { cleanupGeneratedArtifacts, generateProjectArchive, runScaffoldCreateProject } from './scaffold.service.js';
import { cleanupAllDownloads, validateDownloadToken } from './downloads-manager.js';

export async function createProjectController(req, res, next) {
  try {
    const payload = createProjectSchema.parse(req.body ?? {});
    const result = await runScaffoldCreateProject(payload);

    res.status(201).json({
      message: 'Project generated successfully.',
      projectName: payload.projectName,
      output: result.output,
      warnings: result.warnings,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadProjectArchiveController(req, res, next) {
  let artifacts;

  try {
    const payload = createProjectSchema.parse(req.body ?? {});
    artifacts = await generateProjectArchive(payload);
    const downloadUrl = `/api/scaffold/projects/download/${artifacts.downloadToken}`;

    res.status(200).json({
      message: 'Project archive generated successfully.',
      projectName: artifacts.projectName,
      downloadToken: artifacts.downloadToken,
      downloadUrl,
    });

    // Cleanup project directory asynchronously (non-blocking)
    await cleanupGeneratedArtifacts(artifacts);
  } catch (error) {
    await cleanupGeneratedArtifacts(artifacts);
    next(error);
  }
}

export async function validateAndDownloadController(req, res, next) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        message: 'Missing download token.',
      });
    }

    const { filename } = validateDownloadToken(token);
    const filePath = `${req.app.locals.downloadsDir}/${filename}`;

    res.download(filePath, filename, async (downloadError) => {
      if (downloadError && downloadError.code !== 'ERR_HTTP_HEADERS_SENT') {
        next(downloadError);
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function cleanupDownloadsController(req, res, next) {
  try {
    const deletedCount = await cleanupAllDownloads(req.app.locals.downloadsDir);

    res.status(200).json({
      message: 'Downloads cleaned successfully.',
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
}
