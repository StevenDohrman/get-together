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

### Chats

- `GET /me/chats` → list chats you are a member of
- `GET /me/chats/:chatId/messages` → list recent messages
- `POST /me/chats/:chatId/messages` → send message

## Env

- `/health` works without Supabase env configured.
- Configure env in the repo root `.env` (see `.env.example`) to enable `/me`.

For realtime updates, use Supabase Realtime (`postgres_changes`) on the `GroupChatMessage` table.

Example (browser):

```ts
const supabase = getSupabaseBrowserClient();

supabase
	.channel(`chat:${chatId}`)
	.on(
		'postgres_changes',
		{ event: 'INSERT', schema: 'public', table: 'GroupChatMessage', filter: `chatId=eq.${chatId}` },
		payload => {
			// payload.new contains the inserted row (no joined sender data).
			// Typical pattern: re-fetch `/me/chats/:chatId/messages` or append locally.
		},
	)
	.subscribe();
```
