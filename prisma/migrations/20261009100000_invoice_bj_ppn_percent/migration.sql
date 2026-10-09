-- PPN rate per invoice B&J (an MBP can carry a rate other than 11%).
ALTER TABLE "InvoiceBj" ADD COLUMN "ppnPercent" INTEGER NOT NULL DEFAULT 11;
