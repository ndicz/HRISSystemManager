-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "period" TEXT;

-- AlterTable
ALTER TABLE "PayrollEntry" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidTransactionId" TEXT;
