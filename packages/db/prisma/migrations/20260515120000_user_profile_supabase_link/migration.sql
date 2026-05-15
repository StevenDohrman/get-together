-- Link app User rows to Supabase Auth and persist profile fields in Postgres.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supabase_auth_id" UUID;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_supabase_auth_id_key" ON "User"("supabase_auth_id");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
