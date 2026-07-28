-- CreateTable
CREATE TABLE "MbpRequest" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "requesterName" TEXT NOT NULL,
    "siteName" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'menunggu',
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "mbpId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MbpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mbp" (
    "id" TEXT NOT NULL,
    "mbpNo" TEXT NOT NULL,
    "clientId" TEXT,
    "clientNameManual" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobTitle" TEXT,
    "signerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "invoiceBjId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mbp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MbpItem" (
    "id" TEXT NOT NULL,
    "mbpId" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "MbpItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MbpRequest_status_idx" ON "MbpRequest"("status");

-- CreateIndex
CREATE INDEX "MbpRequest_mbpId_idx" ON "MbpRequest"("mbpId");

-- CreateIndex
CREATE UNIQUE INDEX "Mbp_mbpNo_key" ON "Mbp"("mbpNo");

-- CreateIndex
CREATE UNIQUE INDEX "Mbp_invoiceBjId_key" ON "Mbp"("invoiceBjId");

-- CreateIndex
CREATE INDEX "Mbp_clientId_idx" ON "Mbp"("clientId");

-- CreateIndex
CREATE INDEX "Mbp_status_idx" ON "Mbp"("status");

-- AddForeignKey
ALTER TABLE "MbpRequest" ADD CONSTRAINT "MbpRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MbpRequest" ADD CONSTRAINT "MbpRequest_mbpId_fkey" FOREIGN KEY ("mbpId") REFERENCES "Mbp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mbp" ADD CONSTRAINT "Mbp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mbp" ADD CONSTRAINT "Mbp_invoiceBjId_fkey" FOREIGN KEY ("invoiceBjId") REFERENCES "InvoiceBj"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MbpItem" ADD CONSTRAINT "MbpItem_mbpId_fkey" FOREIGN KEY ("mbpId") REFERENCES "Mbp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
