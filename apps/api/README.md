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
- `POST /me/chats/:chatId/messages` → send a message. Body either
  `{ messageType: 'text' | 'system', payload: { body: string } }` or the
  legacy shortcut `{ body: string }` (treated as TEXT).

After persisting, the server publishes the hydrated `ChatMessage` to
Supabase Realtime on the private `chat:<chatId>` broadcast channel. Web
clients use the `useChatRealtime` hook (`apps/web/src/lib/chat`) to
subscribe.

### Chat events

- `POST /me/chats/:chatId/events` → propose an event in this chat
- `PUT /me/chats/:chatId/events/:eventId/rsvp` → set your RSVP
- `DELETE /me/chats/:chatId/events/:eventId/rsvp` → clear your RSVP
- `GET /me/chats/:chatId/events/:eventId` → fetch one event

Mutations are also broadcast (`chat:event:updated`) on the same channel.

## Env

- `/health` works without Supabase env configured.
- Configure env in the repo root `.env` (see `.env.example`) to enable `/me`.
- Chat realtime needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` so the
  server can publish broadcasts via the Realtime REST API. Without them,
  writes still succeed; other clients only see new messages on next refresh.

### Realtime broadcast subscription (browser)

Subscribe to the private chat topic; the channel-auth RLS policy on
`realtime.messages` (see `20260527203000_chat_realtime_broadcast_policies`)
ensures only chat members receive broadcasts.

```ts
const supabase = getSupabaseBrowserClient();
supabase.realtime.setAuth(accessToken);

const channel = supabase
	.channel(`chat:${chatId}`, { config: { private: true } })
	.on('broadcast', { event: 'chat:message:received' }, ({ payload }) => {
		// payload is a fully-hydrated `ChatMessage`.
	})
	.on('broadcast', { event: 'chat:event:updated' }, ({ payload }) => {
		// payload is `{ chatId, event: EventMessagePayload }`.
	})
	.subscribe();
```
