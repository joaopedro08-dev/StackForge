# StackForge Web Initializr

Frontend for generating and downloading scaffolded StackForge projects as ZIP files.

## Environment

The frontend uses `VITE_API_BASE_URL` to call the backend API.

Local development (`web/.env.local`):

```env
VITE_API_BASE_URL=http://localhost:3000
```

Production (Railway API):

```env
VITE_API_BASE_URL=https://your-api-name.up.railway.app
```

You can start from:

- `web/.env.example`
- `web/.env.production.example`

## Run

```bash
pnpm --dir web dev
```

The page will call:

`{VITE_API_BASE_URL}/api/scaffold/projects/download`

## Deploy

Vercel:

- Framework preset: Vite
- Root directory: `web`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-api-name.up.railway.app`
