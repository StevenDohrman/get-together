-- Supabase Realtime (postgres_changes) relies on row-level security policies.
-- These policies allow authenticated users to read chats/members/messages only
-- when they are a member of the chat.

-- Grants: allow authenticated role to read the tables (RLS still applies).
GRANT SELECT ON TABLE "GroupChat" TO authenticated;
GRANT SELECT ON TABLE "GroupChatMember" TO authenticated;
GRANT SELECT ON TABLE "GroupChatMessage" TO authenticated;

-- Members: a user can see membership rows for chats they are a member of.
CREATE POLICY "group_chat_members_select_if_member"
ON "GroupChatMember"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "GroupChatMember" m
    WHERE m."chatId" = "GroupChatMember"."chatId"
      AND m."userId" = auth.uid()
  )
);

-- Chats: a user can see chats they are a member of.
CREATE POLICY "group_chat_select_if_member"
ON "GroupChat"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "GroupChatMember" m
    WHERE m."chatId" = "GroupChat"."id"
      AND m."userId" = auth.uid()
  )
);

-- Messages: a user can see messages in chats they are a member of.
CREATE POLICY "group_chat_messages_select_if_member"
ON "GroupChatMessage"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "GroupChatMember" m
    WHERE m."chatId" = "GroupChatMessage"."chatId"
      AND m."userId" = auth.uid()
  )
);
