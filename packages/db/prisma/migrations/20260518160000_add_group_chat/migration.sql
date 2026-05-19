-- CreateEnum
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'SYSTEM');

-- CreateTable
CREATE TABLE "GroupChat" (
    "id" UUID NOT NULL,
    "proposalId" UUID,
    "groupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatMember" (
    "chatId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChatMember_pkey" PRIMARY KEY ("chatId","userId")
);

-- CreateTable
CREATE TABLE "GroupChatMessage" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupChat_proposalId_key" ON "GroupChat"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupChat_groupId_key" ON "GroupChat"("groupId");

-- CreateIndex
CREATE INDEX "GroupChatMember_userId_idx" ON "GroupChatMember"("userId");

-- CreateIndex
CREATE INDEX "GroupChatMessage_chatId_createdAt_idx" ON "GroupChatMessage"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupChatMessage_senderId_idx" ON "GroupChatMessage"("senderId");

-- AddForeignKey
ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GroupFormationProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupChatMember" ADD CONSTRAINT "GroupChatMember_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupChatMember" ADD CONSTRAINT "GroupChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupChatMessage" ADD CONSTRAINT "GroupChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupChatMessage" ADD CONSTRAINT "GroupChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (same approach as other app tables: enabled, no policies for anon/authenticated)
ALTER TABLE "GroupChat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupChatMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupChatMessage" ENABLE ROW LEVEL SECURITY;
