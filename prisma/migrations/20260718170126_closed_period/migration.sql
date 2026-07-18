-- CreateTable
CREATE TABLE "ClosedPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosedPeriod_period_key" ON "ClosedPeriod"("period");
