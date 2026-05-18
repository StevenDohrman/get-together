# AI Handoff & To-Do

Branch: `feature/ui-ux`
PR: https://github.com/StevenDohrman/get-together/pull/21

## Purpose
Give this file and the repo context to a new AI assistant to connect the frontend work on the dashboard to the backend APIs. Ignore features requiring Locations or Group Chats (they are not available yet).

---

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
## Suggested integration checklist (for the AI)
- [x] Wire `GET /profile` -> populate sidebar/profile components (Phase 1)
- [ ] Wire `PATCH /profile` for user profile edits and update UI on success
- [x] Wire `GET /me/interests` and `PUT /me/interests` to preferences UI (Phase 2)
- [ ] Use `GET /interests` for interest search/autocomplete
- [x] Add loading / error states for each API call (basic components added in Phase 1)
- [ ] Skip locations/group-chats features (stub if UI requires them)

More details and live progress are kept in [docs/AI_HANDOFF_PROGRESS.md](docs/AI_HANDOFF_PROGRESS.md).

## In Progress
- [ ] Phase 1 — Identity wiring (branch: `feature/dashboard-ui`) — fetching profile for Sidebar and Dashboard header
  - [ ] Add `useProfile` hook and small loading/error components
  - [ ] Wire `Sidebar` to `GET /profile` using `apiGet` via `useProfile`
  - [ ] Replace hardcoded greeting in dashboard with profile-driven greeting
  - Notes: Running Phase 1 edits and local tests; will mark items complete after tests pass.

## Notes & gotchas
- API returns `{ error: string }` on failure; `api.ts` throws with that message — show friendly UI messages.
- Auth token is required for `/me/*` and `/profile` endpoints. Ensure Supabase user session exists before calling.
- The frontend work is UI-only and uses static/mock data arrays in many places; replace with API calls as above.

---

If you want, update this file with any additional endpoints or specific fields the backend team adds, or ask me to create the specific code patches to wire these calls into the listed components.
