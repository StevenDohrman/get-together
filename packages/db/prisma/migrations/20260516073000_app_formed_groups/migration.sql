-- App-formed groups are created by the matching system, not by a specific user.
CREATE TYPE "GroupSource" AS ENUM ('USER_CREATED', 'APP_FORMED');

ALTER TABLE "Group" ADD COLUMN "source" "GroupSource" NOT NULL DEFAULT 'USER_CREATED';

ALTER TABLE "Group" DROP CONSTRAINT "Group_createdById_fkey";
ALTER TABLE "Group" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A proposal is seeded by UserGroupSeeking.userId; storing a separate anchor user duplicates that source.
DROP INDEX IF EXISTS "GroupFormationProposal_anchorUserId_idx";
ALTER TABLE "GroupFormationProposal" DROP CONSTRAINT "GroupFormationProposal_anchorUserId_fkey";
ALTER TABLE "GroupFormationProposal" DROP COLUMN "anchorUserId";
