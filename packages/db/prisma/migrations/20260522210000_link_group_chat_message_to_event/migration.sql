-- Wire Event proposals into the group chat: a chat message can now reference
-- the structured Event it announces, and a single Event has at most one
-- announcing chat message (1:1 via UNIQUE on the FK).
--
-- This migration uses `IF NOT EXISTS` everywhere so it is safe to re-run on a
-- database that has the legacy `20260522190000_add_chat_activities` schema
-- partially applied (where `ChatMessageKind` may already contain `EVENT` or
-- `ACTIVITY`, and `GroupChatMessage` may already have an `event_id` column).

-- AlterEnum: add EVENT to ChatMessageKind for event proposal messages.
-- Note: in PostgreSQL, ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block that later USES the new value. We only declare it
-- here and start using it from application code on the next deploy, so
-- this is safe alongside the other DDL statements.
ALTER TYPE "ChatMessageKind" ADD VALUE IF NOT EXISTS 'EVENT';

-- AlterTable: link a chat message to the Event it announces.
ALTER TABLE "GroupChatMessage"
  ADD COLUMN IF NOT EXISTS "event_id" UUID;

-- One Event has at most one announcing message.
CREATE UNIQUE INDEX IF NOT EXISTS "GroupChatMessage_event_id_key"
  ON "GroupChatMessage" ("event_id");

-- AddForeignKey: nullable + SET NULL on Event delete so the chat history
-- survives if an Event is later removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GroupChatMessage_event_id_fkey'
  ) THEN
    ALTER TABLE "GroupChatMessage"
      ADD CONSTRAINT "GroupChatMessage_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "Event"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
