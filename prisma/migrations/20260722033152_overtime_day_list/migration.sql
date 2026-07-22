/*
  Warnings:

  - You are about to drop the column `lemburMerah` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `lemburReguler` on the `PayrollEntry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PayrollEntry" DROP COLUMN "lemburMerah",
DROP COLUMN "lemburReguler";

-- CreateTable
CREATE TABLE "OvertimeDay" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimeDay_employeeId_period_idx" ON "OvertimeDay"("employeeId", "period");

-- AddForeignKey
ALTER TABLE "OvertimeDay" ADD CONSTRAINT "OvertimeDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
