-- Block direct PostgREST access (anon / authenticated JWT) to application tables.
-- Data access is intended to go through apps/api using the service role or DB owner.
-- RLS enabled with no policies denies those roles; service_role bypasses RLS.

ALTER TABLE "Interest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterestRelation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterestEmbedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserInterest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupInterest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventAttendee" ENABLE ROW LEVEL SECURITY;
