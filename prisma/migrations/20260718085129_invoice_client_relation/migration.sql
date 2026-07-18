/*
  Warnings:

  - Added the required column `invoiceNo` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dueDate" DATETIME,
    "gajiTotal" INTEGER NOT NULL,
    "feeTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "sentAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("clientId", "createdAt", "dueDate", "feeTotal", "gajiTotal", "id", "paidAt", "period", "sentAt", "status", "total") SELECT "clientId", "createdAt", "dueDate", "feeTotal", "gajiTotal", "id", "paidAt", "period", "sentAt", "status", "total" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE UNIQUE INDEX "Invoice_clientId_period_key" ON "Invoice"("clientId", "period");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
