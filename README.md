# UConnect

Mobile-first monorepo using pnpm workspaces.

## Structure

- `apps/mobile` — Expo + React Native + TypeScript (Expo Router)
- `apps/api` — Fastify API (TypeScript)
- `apps/web` — Next.js (App Router) + Tailwind (secondary for now)
- `packages/db` — Prisma schema + generated client
- `packages/shared` — shared types/schemas

## Prereqs

- Node.js >= 20
- pnpm via Corepack (`corepack enable`)

For the recommended local setup, you also need:

- Docker (Supabase Local runs in containers)
- Supabase CLI (`supabase`)

## Local setup (recommended)

This repo is designed to run **locally with Supabase Local** (Postgres + Auth) for closest parity with “live”.

### One command bootstrap

```bash
pnpm install
pnpm setup:local
pnpm dev
```

`pnpm setup:local` will:

- start Supabase Local (`supabase start`)
- write a root `.env` using the local URLs/keys from `supabase status`
- write `apps/web/.env.local` with `NEXT_PUBLIC_SUPABASE_*` for the web app
- run Prisma `generate`, `migrate dev`, and `seed`

### Manual local setup

If you prefer to do it step-by-step:

```bash
pnpm install
cp .env.example .env
supabase start
pnpm -C packages/db generate
pnpm -C packages/db prisma migrate deploy
pnpm -C packages/db seed
pnpm dev:api
```

Ports are configured in `supabase/config.toml`.

Env note:

- API + Prisma load root `.env`, and if present, root `.env.local` overrides it.
- The web app reads `apps/web/.env.local` (Next.js public env).

## Live (hosted Supabase)

“Live” will use a hosted Supabase project (Postgres + Auth) with the same API routes.

1) Create a Supabase project

- Create a project in Supabase.
- Copy the project URL + keys into a root `.env` (start from `.env.example`).

2) Point Prisma at the hosted database

- Set `DATABASE_URL` to your Supabase Postgres connection string.

3) Apply schema changes

```bash
pnpm -C packages/db prisma generate
pnpm -C packages/db prisma migrate deploy
```

Notes:

- Never commit `.env` (it contains secrets).
- For production workflows, prefer `prisma migrate deploy` over `migrate dev`.

## Database

Prisma lives in `packages/db` and targets Postgres.

If you can’t install the Supabase CLI yet, you can run a standalone local Postgres (no Auth) using Docker Compose:

```bash
docker compose up -d
pnpm -C packages/db generate
pnpm -C packages/db prisma migrate deploy
pnpm -C packages/db seed
```

Start individually:

```bash
pnpm dev:mobile
pnpm dev:api
pnpm dev:web
```

## Notes

- pnpm uses the same npm registry and packages as npm; it’s just a different package manager.
- Avoid running installs inside `apps/*` or `packages/*`. Use the repo root.
- The API’s `/health` endpoint works without Supabase env; `/me` requires Supabase env vars.

## Contributing

Use feature branches and open PRs into `main`. See `CONTRIBUTING.md`.
