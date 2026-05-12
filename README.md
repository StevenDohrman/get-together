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

## Run locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Database

Prisma lives in `packages/db` and targets Postgres (Supabase-friendly).

```bash
pnpm -C packages/db generate
pnpm -C packages/db migrate:dev -- --name init
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
