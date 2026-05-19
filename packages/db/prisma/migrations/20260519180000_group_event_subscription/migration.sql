-- CreateTable
CREATE TABLE "GroupEventSubscription" (
    "groupId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupEventSubscription_pkey" PRIMARY KEY ("groupId","eventId")
);

-- CreateIndex
CREATE INDEX "GroupEventSubscription_eventId_idx" ON "GroupEventSubscription"("eventId");

-- AddForeignKey
ALTER TABLE "GroupEventSubscription" ADD CONSTRAINT "GroupEventSubscription_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupEventSubscription" ADD CONSTRAINT "GroupEventSubscription_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (same policy as existing app tables: enabled, no policies for anon/authenticated)
ALTER TABLE "GroupEventSubscription" ENABLE ROW LEVEL SECURITY;
