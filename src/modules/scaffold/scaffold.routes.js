import { Router } from 'express';
import { cleanupDownloadsController, createProjectController, downloadProjectArchiveController, validateAndDownloadController } from './scaffold.controller.js';

const scaffoldRouter = Router();

scaffoldRouter.post('/projects', createProjectController);
scaffoldRouter.post('/projects/download', downloadProjectArchiveController);
scaffoldRouter.get('/projects/download/:token', validateAndDownloadController);
scaffoldRouter.delete('/projects/downloads', cleanupDownloadsController);

export { scaffoldRouter };
