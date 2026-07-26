CREATE TABLE "OfflineOperation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyGuideId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payloadHash" TEXT NOT NULL,
    "response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfflineOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfflineOperation_operationId_key" ON "OfflineOperation"("operationId");
CREATE INDEX "OfflineOperation_userId_studyGuideId_status_idx" ON "OfflineOperation"("userId", "studyGuideId", "status");
CREATE INDEX "OfflineOperation_updatedAt_idx" ON "OfflineOperation"("updatedAt");
ALTER TABLE "OfflineOperation" ADD CONSTRAINT "OfflineOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfflineOperation" ADD CONSTRAINT "OfflineOperation_studyGuideId_fkey" FOREIGN KEY ("studyGuideId") REFERENCES "StudyGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
