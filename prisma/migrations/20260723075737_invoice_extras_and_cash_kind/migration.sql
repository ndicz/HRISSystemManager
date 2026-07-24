-- AlterTable
ALTER TABLE "CashAccount" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'besar';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "docHandoverDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvoiceBj" ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountDesc" TEXT,
ADD COLUMN     "docHandoverDate" TIMESTAMP(3),
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "signerName" TEXT;
