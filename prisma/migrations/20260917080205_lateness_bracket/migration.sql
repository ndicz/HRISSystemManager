-- CreateTable
CREATE TABLE "LatenessBracket" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "siteId" TEXT,
    "positionId" TEXT,
    "employeeId" TEXT,
    "minMinutes" INTEGER NOT NULL,
    "maxMinutes" INTEGER,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LatenessBracket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LatenessBracket_scope_siteId_idx" ON "LatenessBracket"("scope", "siteId");

-- CreateIndex
CREATE INDEX "LatenessBracket_scope_positionId_idx" ON "LatenessBracket"("scope", "positionId");

-- CreateIndex
CREATE INDEX "LatenessBracket_scope_employeeId_idx" ON "LatenessBracket"("scope", "employeeId");

-- AddForeignKey
ALTER TABLE "LatenessBracket" ADD CONSTRAINT "LatenessBracket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatenessBracket" ADD CONSTRAINT "LatenessBracket_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LatenessBracket" ADD CONSTRAINT "LatenessBracket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
