# AuthForge

Modern SaaS authentication API built with Node.js + Express, including:

- register
- login
- check logged-in session
- refresh token rotation
- logout

## Stack

- Node.js (ESM)
- Express 5
- JWT (access token)
- Refresh token in `httpOnly` cookie
- Password hashing with bcrypt
- Validation with Zod
- Local persistence with lowdb (JSON file)
- Repository layer ready to evolve to relational or non-relational databases

## Run Locally

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` from the example:

```bash
copy .env.example .env
```

3. Start development:

```bash
pnpm dev
```

Or run in normal mode:

```bash
pnpm start
```

## Developer Bootstrap

Create a new auth API project in the default workspace folder:

```bash
pnpm dev:new-project -- your-api-name
```

The project is created at `developers/projects/your-api-name`.

Profiles:

- `lite` (default): smaller template with faster startup
- `full`: includes tests, docs, and CI

Examples:

```bash
pnpm dev:new-project -- your-api-name --full
pnpm dev:new-project -- your-api-name --lang=typescript
pnpm dev:new-project -- your-api-name --ts
pnpm dev:new-project -- your-api-name --full --lang=typescript
```

When using `--lang=typescript`, the generated project uses `.ts` files for core application code and keeps the scaffold lean by omitting the `scripts` folder.

Generation guarantees:

- `--lang=javascript`: generates runtime files in JavaScript (`index.js`, `src/**/*.js`) with Vitest config in `.mjs` and no TypeScript project artifacts.
- `--lang=typescript`: generates runtime files in TypeScript (`index.ts`, `src/**/*.ts`) with imports aligned to TS and runtime start compatible with Docker (`pnpm start`).
- Docker startup stays language-agnostic through `pnpm start`, preventing hardcoded `index.js` drift.

Modern auth baseline in generated projects:

- short-lived access token + rotating refresh token flow
- refresh token in secure `httpOnly` cookie
- CSRF protection for cookie-based session flows
- login throttling/rate-limit middleware
- structured logging and request context for observability

Integration-ready architecture for future evolution:

- layered modules (`controllers`, `services`, `repositories`)
- Prisma + schema management prepared for relational providers
- OpenAPI documentation scaffold and integration test entry points
- environment-driven configuration for cloud and container workflows

Quick team guide:

- `developers/README.md`

## Project Standards

- Contribution guide: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`
- Code of conduct: `CODE_OF_CONDUCT.md`
- PR template: `.github/pull_request_template.md`
- Issue templates: `.github/ISSUE_TEMPLATE/`

## Quality and CI

Local quality commands:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm audit
```

CI pipeline:

- file: `.github/workflows/ci.yml`
- triggers: `push` (main/master) and `pull_request`
- stages: install, lint, test, security audit

## Production

Operational runbook:

- `docs/production-runbook.md`

Minimum checklist before deployment:

- start from `.env.production.example`
- define strong JWT secrets (`JWT_ACCESS_SECRET`, `JWT_ACCESS_SECRETS`)
- use `DATABASE_PROVIDER=postgresql` with a real `DATABASE_URL`
- restrict `CORS_ALLOWED_ORIGINS` to real frontend domains
- run behind HTTPS/reverse proxy

### Deploy with Docker Compose

Compose file: `docker-compose.production.yml`.

Start stack (API + PostgreSQL):

```bash
docker compose -f docker-compose.production.yml up -d
```

Full rebuild when dependencies or Dockerfile changed:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Stop stack:

```bash
docker compose -f docker-compose.production.yml down
```

Recommended local flow (startup + verification):

```bash
pnpm prod:deploy:local
```

Helper commands:

```bash
pnpm prod:up
pnpm prod:up:build
pnpm prod:up:dbport -- 55432
pnpm prod:ps
pnpm prod:smoke
pnpm prod:smoke:auth
pnpm prod:verify
pnpm prod:recovery:test
pnpm prod:down
pnpm prod:reset
pnpm perf:docker:du
pnpm perf:docker:clean
pnpm perf:docker:clean:volumes
pnpm perf:docker:maintain
```

Notes:

- `prod:up` avoids image rebuild by default. Use `prod:up:build` only when needed.
- API container runs `pnpm prisma:bootstrap` (`db push`) before server start to keep schema consistent.
- Replace `change_me` values with real secrets.
- Prefer injecting secrets through a secret manager in managed environments.
- Set `APP_HOST_PORT` in `.env.production` if `3000` is in use.
- Set `POSTGRES_HOST_PORT` in `.env.production` for external DB tools (DBeaver, DataGrip, scripts).
- For quick custom host port tests without editing `.env.production`, use `pnpm prod:up:dbport -- 55432`.
- Container log rotation is configured with `DOCKER_LOG_MAX_SIZE` and `DOCKER_LOG_MAX_FILE`.

## Environment Variables

See `.env.example`:

- `NODE_ENV` (`development`, `test`, `production`)
- `PORT` (API port)
- `DOCKER_LOG_MAX_SIZE` (max container log file size, e.g. `10m`)
- `DOCKER_LOG_MAX_FILE` (max number of log files per container)
- `CORS_ORIGIN` (frontend origin, e.g. `http://localhost:5173`)
- `CORS_ALLOWED_ORIGINS` (comma-separated allowlist)
- `DATABASE_PROVIDER` (`json`, `mysql`, `postgresql`, `sqlite`, `sqlserver`)
- `DATABASE_URL` (relational DB connection string; if empty, defaults are derived from provider + `DB_PORT_*`)
- `POSTGRES_HOST_PORT` (published PostgreSQL port on host for production compose)
- `DB_PORT_MYSQL` (default `3306`)
- `DB_PORT_POSTGRESQL` (default `5432`)
- `DB_PORT_SQLITE` (SQLite uses no network port, keep `0`)
- `DB_PORT_SQLSERVER` (default `1433`)
- `AUTH_RATE_LIMIT_WINDOW_MINUTES`
- `AUTH_RATE_LIMIT_MAX_REQUESTS`
- `LOGIN_ATTEMPT_WINDOW_MINUTES`
- `LOGIN_MAX_FAILED_ATTEMPTS`
- `LOGIN_BLOCK_DURATION_MINUTES`
- `LOGIN_BLOCK_BACKOFF_MULTIPLIER`
- `LOGIN_MAX_BLOCK_DURATION_MINUTES`
- `CSRF_TOKEN_TTL_MINUTES`
- `JWT_ACCESS_ACTIVE_KID`
- `JWT_ACCESS_SECRETS` (`kid:secret,kid2:secret2`)
- `JWT_ACCESS_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN` (e.g. `15m`)
- `REFRESH_TOKEN_TTL_DAYS`

## Tooling Configuration

- Formatting: `prettier.config.cjs`
- Type checking baseline: `tsconfig.json`
- Monorepo-ready task graph: `turbo.json`
- Vitest project config: `vitest.config.ts`
- Vitest workspace config: `vitest.workspace.ts`

## License and Releases

- License: `LICENSE`
- Change history: `CHANGELOG.md`

## Endpoints

Base URL: `http://localhost:3000`

### API Docs

- `GET /openapi.json`
- `GET /docs`

### Health

- `GET /health/liveness`
- `GET /health/readiness`
- `GET /health` (alias for readiness)

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh-token`
- `POST /auth/logout`

Example register payload:

```json
{
  "name": "John Smith",
  "email": "john@email.com",
  "password": "StrongPass123",
  "confirmPassword": "StrongPass123"
}
```

## Security Highlights

- Progressive and persistent login lockout by IP + email
- Refresh token family rotation with reuse detection
- CSRF protection on refresh/logout
- `helmet` hardening enabled
- Multi-origin CORS allowlist via `CORS_ALLOWED_ORIGINS`
- JWT key rotation support with `kid`
