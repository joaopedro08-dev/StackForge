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
```

## First Start for the Generated Project

```bash
cd developers/projects/your-api-name
pnpm install
copy .env.example .env
pnpm dev
```

## Team Conventions

- Use kebab-case for project folder names.
- Keep `.env` files out of version control.
- Run `pnpm lint` and `pnpm test` before opening a PR.
