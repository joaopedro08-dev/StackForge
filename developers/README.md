# Developer Workspace

This workspace centralizes bootstrap for new authentication API projects.

## Default Folder

All new projects should be created under:

- `developers/projects/<project-name>`

## Bootstrap Command

From the repository root, run:

```bash
pnpm dev:new-project -- your-api-name
```

This creates a new folder in `developers/projects/` with a functional authentication API template.

### Project Profiles

- Default (`lite`): smaller project with faster startup.
- Complete (`full`): includes docs, tests, and CI workflow.

Quick comparison:

- `lite`: .dockerignore, .env files, Dockerfile, production compose, ESLint, index, package.json, pnpm-lock, prisma, and src.
- `full`: everything from `lite` plus `.github`, `docs`, and `tests`.

Full profile example:

```bash
pnpm dev:new-project -- your-api-name --full
```

### Project Language

- Default: `javascript`
- Optional: `typescript` (generates core files in `.ts`, with no `scripts` folder and no `.js` imports in source files)

Language consistency guarantees:

- JavaScript profile outputs JavaScript runtime (`index.js`, `src/**/*.js`) and Vitest configs in `.mjs`.
- TypeScript profile outputs TypeScript runtime (`index.ts`, `src/**/*.ts`) with TypeScript-ready imports.
- Docker startup is normalized to `pnpm start`, avoiding hardcoded `index.js` or `index.ts` coupling.

Auth and integration baseline included in new projects:

- modern token flow (access + rotating refresh)
- cookie + CSRF protection pattern
- rate limit and login-attempt protections
- Prisma-backed data layer ready for PostgreSQL and other providers
- test/docs scaffold (`full`) to accelerate integrations

Examples:

```bash
pnpm dev:new-project -- your-api-name --lang=typescript
pnpm dev:new-project -- your-api-name --ts
pnpm dev:new-project -- your-api-name --full --lang=typescript
pnpm dev:new-project -- your-api-name --db=mysql
pnpm dev:new-project -- your-api-name --db=sqlite
pnpm dev:new-project -- your-api-name --db=sqlserver
pnpm dev:new-project -- your-api-name --db=json
pnpm dev:new-project -- your-api-name --architecture=mvc
pnpm dev:new-project -- your-api-name --architecture=clean
pnpm dev:new-project -- your-api-name --api=graphql
pnpm dev:new-project -- your-api-name --api=hybrid
pnpm dev:new-project -- your-api-name --pm=npm
pnpm dev:new-project -- your-api-name --pm=yarn
pnpm dev:new-project -- your-api-name --pm=bun
pnpm dev:new-project -- --interactive
```

### Package Manager

- Default: `pnpm`
- Optional: `npm`, `yarn`, `bun`

Examples:

```bash
pnpm dev:new-project -- your-api-name --pm=npm
pnpm dev:new-project -- your-api-name --pm=yarn
pnpm dev:new-project -- your-api-name --pm=bun
```

Smoke validation note:

- `yarn` scenarios run via `corepack` when available.
- `bun` scenarios require bun runtime support and are skipped when unavailable.

### Database Provider

- Default: `json` (no Prisma dependency in generated project)
- Relational via Prisma: `postgresql`, `mysql`, `sqlite`, `sqlserver`

Example:

```bash
pnpm dev:new-project -- your-api-name --db=postgresql
```

### Architecture

- Default: `layered`
- Optional: `mvc`, `clean`

Examples:

```bash
pnpm dev:new-project -- your-api-name --architecture=mvc
pnpm dev:new-project -- your-api-name --architecture=clean
```

### API Style

- Default: `rest`
- Optional: `graphql`, `hybrid`

Examples:

```bash
pnpm dev:new-project -- your-api-name --api=graphql
pnpm dev:new-project -- your-api-name --api=hybrid
```

## First Start for the Generated Project

```bash
cd developers/projects/your-api-name
pnpm install
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
pnpm dev
```

If you generated with another package manager, replace commands accordingly (for example `npm install`, `yarn install`, or `bun install`).

## Team Conventions

- Use kebab-case for project folder names.
- Keep `.env` files out of version control.
- Run `pnpm lint` and `pnpm test` before opening a PR.

## Improvement Backlog

- Scaffold and runtime roadmap: `developers/scaffold-improvements.md`
