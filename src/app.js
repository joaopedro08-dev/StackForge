import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { checkDatabaseReadiness } from './db/health.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { requestContextMiddleware } from './middlewares/request-context.middleware.js';
import { authRateLimiter } from './middlewares/rate-limit.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { emailRouter } from './modules/email/email.routes.js';
import { scaffoldRouter } from './modules/scaffold/scaffold.routes.js';
import { initializeDownloadsManager } from './modules/scaffold/downloads-manager.js';

const app = express();

// Initialize downloads manager
const downloadsDir = path.resolve(process.cwd(), 'web', 'public', 'downloads');
initializeDownloadsManager(downloadsDir);
app.locals.downloadsDir = downloadsDir;

function resolveOpenApiDocument() {
  if (env.EMAIL_ENABLED) {
    return openApiDocument;
  }

  const clonedDocument = structuredClone(openApiDocument);
  delete clonedDocument.paths['/email/send'];
  return clonedDocument;
}

const corsAllowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);

const corsOptions = {
  origin(origin, callback) {
    // Requests without Origin (curl, server-to-server) do not require CORS.
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, corsAllowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
  credentials: true,
  maxAge: 600,
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

app.use(requestContextMiddleware);
app.use(
  helmet({
    // Swagger UI injects inline scripts; disabling CSP keeps /docs working.
    contentSecurityPolicy: false,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') {
    next();
    return;
  }

  cors(corsOptions)(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    if (req.headers.origin && corsAllowedOrigins.has(req.headers.origin)) {
      res.sendStatus(204);
      return;
    }

    next();
  });
});

app.get('/health/liveness', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/openapi.json', (_req, res) => {
  res.status(200).json(resolveOpenApiDocument());
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get('/health/readiness', async (_req, res) => {
  const dbReadiness = await checkDatabaseReadiness();

  if (!dbReadiness.ok) {
    return res.status(503).json({
      status: 'degraded',
      checks: {
        database: dbReadiness,
      },
    });
  }

  return res.status(200).json({
    status: 'ok',
    checks: {
      database: dbReadiness,
    },
  });
});

app.get('/health', async (_req, res) => {
  const dbReadiness = await checkDatabaseReadiness();

  if (!dbReadiness.ok) {
    return res.status(503).json({
      status: 'degraded',
      checks: {
        database: dbReadiness,
      },
    });
  }

  return res.status(200).json({
    status: 'ok',
    checks: {
      database: dbReadiness,
    },
  });
});

app.use('/auth', authRateLimiter, authRouter);

if (env.EMAIL_ENABLED) {
  app.use('/email', emailRouter);
}

app.use('/api/scaffold', scaffoldRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
