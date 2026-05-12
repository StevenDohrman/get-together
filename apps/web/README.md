UConnect web app (Next.js).

## Getting Started

From the repo root:

```bash
pnpm dev:web
```

Or from this folder:

```bash
pnpm dev
```

### Env

The auth UI uses Supabase Auth directly. Create `apps/web/.env.local`:

```bash
cp .env.example .env.local
```

Key vars:

- `NEXT_PUBLIC_SUPABASE_URL` (local default: `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from `supabase status`)

After changing env vars, restart the dev server.

### Auth UI

- `http://localhost:3000/auth` (login/signup)
- `http://localhost:3000/profile` (view/update username)

For Supabase Local, magic link emails show up in Inbucket (see `supabase status` for the URL).

### Troubleshooting: “NetworkError when attempting to fetch resource”

This usually means the browser can’t reach Supabase.

- Make sure Supabase Local is running: `supabase start` (or `pnpm setup:local` from repo root)
- Confirm `NEXT_PUBLIC_SUPABASE_URL` points at the right host/port

## Notes

- Username is stored in Supabase `user_metadata.username`.
