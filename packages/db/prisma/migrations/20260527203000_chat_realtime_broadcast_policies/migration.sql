-- Realtime authorization for the group-chat broadcast channel.
--
-- The app server publishes chat events via Supabase Realtime Broadcast on the
-- private topic "chat:<chatId>" (using the service role, so writes bypass
-- RLS). Clients subscribe with their Supabase JWT, and the SELECT policy on
-- realtime.messages below decides whether they're allowed to receive.
--
-- This migration also repairs the SELECT policies on the public chat tables
-- introduced by 20260518170000_group_chat_realtime_policies, which compared
-- "GroupChatMember"."userId" directly against auth.uid(). Those values live
-- in different namespaces — "GroupChatMember"."userId" is the Prisma User.id,
-- whereas auth.uid() is the Supabase auth id stored on "User".supabase_auth_id
-- — so the original policies never matched any rows.

-- 1. Helper: is the given Supabase auth user a member of the given chat?
--    SECURITY DEFINER so we can join through "User" (which has RLS enabled
--    with no anon/authenticated policies). Owned by the table owner so RLS is
--    bypassed during the lookup.
CREATE OR REPLACE FUNCTION public.is_chat_member_for_auth(
  p_chat_id uuid,
  p_auth_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "GroupChatMember" m
    JOIN "User" u ON u.id = m."userId"
    WHERE m."chatId"          = p_chat_id
      AND u.supabase_auth_id  = p_auth_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_member_for_auth(uuid, uuid)
  TO authenticated;

-- 2. Repair the public-table SELECT policies. The chat client no longer
--    relies on these (it uses Broadcast), but leaving them broken is a
--    footgun for anyone who later reaches for postgres_changes on these
--    tables. Same intent as the original policies, just with the correct
--    auth.uid() <-> User.id bridge.
DROP POLICY IF EXISTS "group_chat_members_select_if_member" ON "GroupChatMember";
CREATE POLICY "group_chat_members_select_if_member"
ON "GroupChatMember"
FOR SELECT
TO authenticated
USING (
  public.is_chat_member_for_auth(
    "GroupChatMember"."chatId",
    (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "group_chat_select_if_member" ON "GroupChat";
CREATE POLICY "group_chat_select_if_member"
ON "GroupChat"
FOR SELECT
TO authenticated
USING (
  public.is_chat_member_for_auth(
    "GroupChat"."id",
    (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "group_chat_messages_select_if_member" ON "GroupChatMessage";
CREATE POLICY "group_chat_messages_select_if_member"
ON "GroupChatMessage"
FOR SELECT
TO authenticated
USING (
  public.is_chat_member_for_auth(
    "GroupChatMessage"."chatId",
    (SELECT auth.uid())
  )
);

-- 3. Authorize Realtime Broadcast on private "chat:<chatId>" topics.
--    realtime.topic() returns the topic being subscribed to / sent to.
--    The server publishes via the service role (RLS bypassed), so we only
--    need a SELECT policy gating who can subscribe and receive.
DROP POLICY IF EXISTS "chat_broadcast_select_if_member"
  ON "realtime"."messages";
CREATE POLICY "chat_broadcast_select_if_member"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() LIKE 'chat:%'
  AND public.is_chat_member_for_auth(
    (substring(realtime.topic() FROM 6))::uuid,
    (SELECT auth.uid())
  )
);
