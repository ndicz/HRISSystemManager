-- CreateTable
CREATE TABLE "AllowancePayment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "desc" TEXT,
    "transactionId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllowancePayment_employeeId_idx" ON "AllowancePayment"("employeeId");

-- AddForeignKey
ALTER TABLE "AllowancePayment" ADD CONSTRAINT "AllowancePayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
