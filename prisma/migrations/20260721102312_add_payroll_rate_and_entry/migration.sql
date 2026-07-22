-- CreateTable
CREATE TABLE "PayrollRate" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "siteId" TEXT,
    "izinRate" INTEGER NOT NULL DEFAULT 0,
    "alphaRate" INTEGER NOT NULL DEFAULT 0,
    "terlambatRate" INTEGER NOT NULL DEFAULT 0,
    "lemburRegulerRate" INTEGER NOT NULL DEFAULT 0,
    "lemburMerahRate" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lemburReguler" INTEGER NOT NULL DEFAULT 0,
    "lemburMerah" INTEGER NOT NULL DEFAULT 0,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRate_period_idx" ON "PayrollRate"("period");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRate_period_siteId_key" ON "PayrollRate"("period", "siteId");

-- CreateIndex
CREATE INDEX "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_employeeId_period_key" ON "PayrollEntry"("employeeId", "period");

-- AddForeignKey
ALTER TABLE "PayrollRate" ADD CONSTRAINT "PayrollRate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
