# @uconnect/api

Fastify API.

## Dev

From repo root:

```bash
pnpm dev:api
```

## Endpoints

- `GET /health` → `{ ok: true }`
- `GET /me` with `Authorization: Bearer <access_token>` → returns Supabase user (requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)
- `POST /auth/signup` → `410` (deprecated; clients should use Supabase magic link / OAuth directly)
- `POST /auth/login` → `410` (deprecated; clients should use Supabase magic link / OAuth directly)
- `GET /auth/me` with `Authorization: Bearer <access_token>` → returns Supabase user (requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`)

## Env

- `/health` works without Supabase env configured.
- Configure env in the repo root `.env` (see `.env.example`) to enable `/me`.
