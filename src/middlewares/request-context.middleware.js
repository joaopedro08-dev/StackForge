import crypto from 'node:crypto';
import { info } from '../utils/logger.js';

const REQUEST_ID_HEADER = 'x-request-id';

function resolveRequestId(req) {
  const incomingRequestId = req.get(REQUEST_ID_HEADER);

  if (incomingRequestId && incomingRequestId.trim()) {
    return incomingRequestId.trim();
  }

  return crypto.randomUUID();
}

export function requestContextMiddleware(req, res, next) {
  const requestId = resolveRequestId(req);
  const requestStart = Date.now();

  req.context = {
    requestId,
    requestStart,
  };

  res.setHeader(REQUEST_ID_HEADER, requestId);

  res.on('finish', () => {
    info('http_request_completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - requestStart,
      ip: req.ip,
    });
  });

  next();
}
