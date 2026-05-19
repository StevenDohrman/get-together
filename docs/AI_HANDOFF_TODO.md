# AI Handoff & To-Do

Branch: `feature/ui-ux`
PR: https://github.com/StevenDohrman/get-together/pull/21

## Purpose
Give this file and the repo context to a new AI assistant to connect the frontend work on the dashboard to the backend APIs. Ignore features requiring Locations or Group Chats (they are not available yet).

---

## Quick Note
Make the code modular, human readable, with good coding practices, use pre-built libraries, and follow coding conventions. You are a worldclass programer.

Also after finishing a major task make a commit. Commits should be done in a reasonable frequency seperating functionality. Also update the todo and the progress files in docs as you work.

The naming of commits should be brief and descriptive of the work not the stage it's on

## Quick repo map (frontend)
- Dashboard page: `apps/web/src/app/dashboard/page.tsx`
- Sidebar / profile UI: `apps/web/src/components/Sidebar.tsx`
- Reusable components: `apps/web/src/components/DashboardHeader.tsx`, `apps/web/src/components/EventCard.tsx`, `apps/web/src/components/ActivityItem.tsx`, `apps/web/src/components/CommunityCard.tsx`
- API helpers: `apps/web/src/lib/api.ts`, `apps/web/src/lib/supabaseBrowser.ts`

## Backend routes available (from `apps/api`)
- Profile
  - `GET /profile` → { supabaseUserId, email, appUserId, username, displayName }
  - `PATCH /profile` → body `{ username?: string|null, displayName?: string|null }`
  - File: `apps/api/src/routes/profile.ts`
- Interests
  - `GET /me/interests`
  - `PUT /me/interests` → body `{ interests: [{ interestId: string, weight: number }] }`
  - Search / tree / related / embedding:
    - `GET /interests?q=...`
    - `GET /interests/tree?depth=N`
    - `GET /interests/:id/related?depth=N`
    - `GET /interests/:id/embedding`
  - File: `apps/api/src/routes/interests.ts`
- Auth
  - `GET /auth/me` (but client should prefer Supabase client directly)
  - File: `apps/api/src/routes/auth.ts`

## How frontend should call APIs
- Use `apiGet<T>(path)` and `apiJson<T>(path, method, body)` from `apps/web/src/lib/api.ts`.
- `api.ts` automatically sets `Authorization: Bearer <access_token>` by reading Supabase session via `getSupabaseBrowserClient()`.
- Ensure `NEXT_PUBLIC_API_URL` is set to `http://localhost:4000` (or provide env override).

## Dev & test steps for the AI
1. Ensure env variables in `apps/web/.env.local`:
   - `NEXT_PUBLIC_API_URL=http://localhost:4000`
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for auth flows
2. Start API (repo root):
   - `pnpm --filter @uconnect/api dev`
3. Start web (repo root):
   - `pnpm --filter @uconnect/web dev`
4. Sign in with Supabase auth in the browser, visit `/dashboard`.
5. Verify API calls in browser network tab and observe UI updates.

## Suggested integration checklist (for the AI)
- [x] Wire `GET /profile` -> populate sidebar/profile components (Phase 1)
- [x] Wire `PATCH /profile` for user profile edits and update UI on success
- [x] Wire `GET /me/interests` and `PUT /me/interests` to preferences UI (Phase 2)
- [x] Use `GET /interests` for interest search/autocomplete
- [x] Add loading / error states for each API call (basic components added in Phase 1)
- [ ] Skip locations/group-chats features (stub if UI requires them)

More details and live progress are kept in [docs/AI_HANDOFF_PROGRESS.md](docs/AI_HANDOFF_PROGRESS.md).


### Dashboard Note
- Work done and functionality:
  - Dashboard now shows real profile identity in the sidebar/header.
  - Dashboard communities are loaded from `GET /me/groups` and rendered as live cards.
  - Loading, empty-state, and error handling are in place for profile and group fetches.
  - Profile edits use `PATCH /profile`, and interests use `GET /me/interests` + `PUT /me/interests`.
- Work still needed:
  - Build `GET /interests` search/autocomplete UI if you want richer interest discovery.
  - Decide whether to implement or permanently skip the locations/group-chats items.
  - Add any additional dashboard widgets or data sources beyond the current static events/activity sections.

## Notes & gotchas
- API returns `{ error: string }` on failure; `api.ts` throws with that message — show friendly UI messages.
- Auth token is required for `/me/*` and `/profile` endpoints. Ensure Supabase user session exists before calling.
- The frontend work is UI-only and uses static/mock data arrays in many places; replace with API calls as above.

---

## Discover Page — Roadmap & Integration

Purpose: Implement the Find / Discover experience (profile cards, filters, swipe actions, and quick connects) and wire it to backend discovery/matching endpoints.

Core frontend pieces (suggested files):
- `apps/web/src/app/discover/page.tsx` — main route /discover (or `/find`) that composes client/server parts
- `apps/web/src/components/DiscoverClient.tsx` — client-side composition that uses hooks and renders the interaction controls
- `apps/web/src/components/DiscoverCard.tsx` — individual profile card UI (photo, name, tags, bio, action buttons)
- `apps/web/src/components/DiscoverFilters.tsx` — filters panel (location, age range, interests, online status)
- `apps/web/src/lib/hooks/useDiscovery.ts` — hook wrapping discovery API + pagination + loading/error state
- `apps/web/src/lib/hooks/useSwipes.ts` — hook for posting swipe decisions and optimistic UI

Backend endpoints to wire (available):
- `GET /matching/discovery?limit=N` — returns `{ users }` (discovery cards). File: `apps/api/src/routes/matching.ts`
- `POST /matching/swipes` — body `{ targetUserId, decision }` to record swipe decisions and possibly trigger formation proposals

Integration checklist (high level):
- [ ] Create `useDiscovery` to call `GET /matching/discovery` using `apiGet`.
- [ ] Build `DiscoverCard` visual matching the design and reuse `EventCard`/`CommunityCard` patterns where appropriate.
- [ ] Add `DiscoverClient` to handle pagination, filters, loading, and swipe actions.
- [ ] Implement `useSwipes` to post to `POST /matching/swipes` and handle optimistic updates and formation results.
- [ ] Add Filters UI wired to query parameters (client-side state + optional query to backend when supported).
- [ ] Add accessible keyboard controls and loading / empty / error states.
- [ ] Add unit/integration tests for `useDiscovery` + `useSwipes` (mock API responses).

Dev & test notes for Discover page:
- Use existing API helpers: `apiGet<T>(path)` and `apiJson<T>(path, method, body)` in `apps/web/src/lib/api.ts` so auth headers are consistent.
- Ensure `NEXT_PUBLIC_API_URL` points to the running API (default `http://localhost:4000`).
- Start API: `pnpm --filter @uconnect/api dev` and Web: `pnpm --filter @uconnect/web dev`.
- Sign-in with Supabase in the browser before visiting `/discover` so `/me/*` protected endpoints work.

Current work / what is already available:
- Backend discovery endpoints exist: `GET /matching/discovery` and `POST /matching/swipes` (see `apps/api/src/routes/matching.ts`).
- Frontend has shared API helpers (`api.ts`) and common visual components (cards, loading, error messages) that can be reused.
- Profile, interests, and groups wiring already completed and validated (see earlier checklist items).

UX decisions to confirm before implementation:
- Route path (`/discover` vs `/find`), mobile layout priorities, whether filters should persist in URL, and how to paginate (cursor vs page).


## Discover — Staged, commit-friendly TODOs

Break the Discover work into small, commitable stages. Complete and commit each stage (use the suggested branch/commit tag), then move to the next.

1. Stage 1 — Basic discovery fetch + UI (commit: `discovery/init`) — Completed
  - Fetch `GET /matching/discovery` via `useDiscovery` and render `DiscoverCard` placeholders.
  - Minimal client composition: `DiscoverClient` with Load more / Refresh controls.

2. Stage 2 — Swipe actions + optimistic updates (commit: `discovery/swipes`) — Completed
  - Implement `useSwipes` to POST to `/matching/swipes`.
  - Wire optimistic UI removal and simple error recovery via `refetch()`.

3. Stage 3 — Accessibility, keyboard controls, and UI polish (commit: `discovery/a11y-polish`) — Not started
  - Keyboard swipe/selection support, focus management, ARIA labels, and responsive layout tweaks.
  - Add loading skeletons, better empty states, and micro-interactions.

4. Stage 4 — Tests: unit and integration for hooks (commit: `discovery/tests`) — Not started
  - Unit tests for `useDiscovery` and `useSwipes` (mock `apiGet`/`apiJson`).
  - Integration / component tests for `DiscoverClient` and `DiscoverFilters`.

5. Stage 5 — Final docs, progress update, and open PR (commit: `discovery/release`) — Not started
  - Update `docs/AI_HANDOFF_PROGRESS.md` with stage completion notes and PR link.
  - Open PR, add testing notes, and request UI review.

Notes on commits/branches:
- Use short-lived feature branches named after the commit tags above (e.g., `feature/discovery/init`).
- Make focused commits per stage and link them in the progress doc so reviewers can follow incremental progress.




