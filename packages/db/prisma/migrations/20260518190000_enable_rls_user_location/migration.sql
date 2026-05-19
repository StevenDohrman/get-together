-- Enable RLS on UserLocation to prevent direct PostgREST access.
-- Data access is intended to go through apps/api using the service role.
ALTER TABLE "UserLocation" ENABLE ROW LEVEL SECURITY;
