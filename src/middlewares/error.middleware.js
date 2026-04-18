import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { error as logError } from '../utils/logger.js';

export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'Route not found.'));
}

export function errorHandler(error, _req, res, _next) {
  void _next;

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed.',
      issues: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  logError('unhandled_error', {
    requestId: _req.context?.requestId,
    path: _req.originalUrl,
    method: _req.method,
    errorName: error?.name,
    errorMessage: error?.message,
  });

  return res.status(500).json({
    message: 'Internal server error.',
  });
}
