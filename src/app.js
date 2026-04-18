import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { checkDatabaseReadiness } from './db/health.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { requestContextMiddleware } from './middlewares/request-context.middleware.js';
import { authRateLimiter } from './middlewares/rate-limit.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';

const app = express();

const corsOptions = {
  origin(origin, callback) {
    // Requests without Origin (curl, server-to-server) do not require CORS.
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, env.CORS_ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true,
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

    if (req.headers.origin && env.CORS_ALLOWED_ORIGINS.includes(req.headers.origin)) {
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
  res.status(200).json(openApiDocument);
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

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
