-- CreateEnum
CREATE TYPE "SwipeDecision" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "GroupFormationStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormationInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "UserSwipe" (
    "swiperId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "decision" "SwipeDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSwipe_pkey" PRIMARY KEY ("swiperId","targetUserId")
);

-- CreateTable
CREATE TABLE "UserGroupSeeking" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "targetGroupSize" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGroupSeeking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupSeekingInterest" (
    "userGroupSeekingId" UUID NOT NULL,
    "interestId" UUID NOT NULL,

    CONSTRAINT "UserGroupSeekingInterest_pkey" PRIMARY KEY ("userGroupSeekingId","interestId")
);

-- CreateTable
CREATE TABLE "GroupFormationProposal" (
    "id" UUID NOT NULL,
    "anchorUserId" UUID NOT NULL,
    "userGroupSeekingId" UUID NOT NULL,
    "status" "GroupFormationStatus" NOT NULL DEFAULT 'OPEN',
    "formedGroupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupFormationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupFormationInvite" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "FormationInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupFormationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupFormationProposal_formedGroupId_key" ON "GroupFormationProposal"("formedGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupFormationInvite_proposalId_userId_key" ON "GroupFormationInvite"("proposalId", "userId");

-- CreateIndex
CREATE INDEX "UserSwipe_targetUserId_idx" ON "UserSwipe"("targetUserId");

-- CreateIndex
CREATE INDEX "UserGroupSeeking_userId_idx" ON "UserGroupSeeking"("userId");

-- CreateIndex
CREATE INDEX "UserGroupSeekingInterest_interestId_idx" ON "UserGroupSeekingInterest"("interestId");

-- CreateIndex
CREATE INDEX "GroupFormationProposal_anchorUserId_idx" ON "GroupFormationProposal"("anchorUserId");

-- CreateIndex
CREATE INDEX "GroupFormationProposal_status_idx" ON "GroupFormationProposal"("status");

-- CreateIndex
CREATE INDEX "GroupFormationInvite_userId_idx" ON "GroupFormationInvite"("userId");

-- CreateIndex
CREATE INDEX "GroupFormationInvite_proposalId_idx" ON "GroupFormationInvite"("proposalId");

-- AddForeignKey
ALTER TABLE "UserSwipe" ADD CONSTRAINT "UserSwipe_swiperId_fkey" FOREIGN KEY ("swiperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSwipe" ADD CONSTRAINT "UserSwipe_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGroupSeeking" ADD CONSTRAINT "UserGroupSeeking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGroupSeekingInterest" ADD CONSTRAINT "UserGroupSeekingInterest_userGroupSeekingId_fkey" FOREIGN KEY ("userGroupSeekingId") REFERENCES "UserGroupSeeking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGroupSeekingInterest" ADD CONSTRAINT "UserGroupSeekingInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupFormationProposal" ADD CONSTRAINT "GroupFormationProposal_anchorUserId_fkey" FOREIGN KEY ("anchorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupFormationProposal" ADD CONSTRAINT "GroupFormationProposal_userGroupSeekingId_fkey" FOREIGN KEY ("userGroupSeekingId") REFERENCES "UserGroupSeeking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupFormationProposal" ADD CONSTRAINT "GroupFormationProposal_formedGroupId_fkey" FOREIGN KEY ("formedGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GroupFormationInvite" ADD CONSTRAINT "GroupFormationInvite_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GroupFormationProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupFormationInvite" ADD CONSTRAINT "GroupFormationInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (same policy as existing app tables: enabled, no policies for anon/authenticated)
ALTER TABLE "UserSwipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserGroupSeeking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserGroupSeekingInterest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupFormationProposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupFormationInvite" ENABLE ROW LEVEL SECURITY;
