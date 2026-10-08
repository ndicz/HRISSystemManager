-- THR "sudah dibayar" becomes per employee per year instead of a lifetime flag.
CREATE TABLE "ThrPayment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThrPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ThrPayment_employeeId_year_key" ON "ThrPayment"("employeeId", "year");

ALTER TABLE "ThrPayment" ADD CONSTRAINT "ThrPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry existing payouts over: each employee already marked paid gets a row
-- for the year of their latest "Pembayaran THR — <name>" Kas entry (or the
-- current year if none is found), with that entry's amount.
INSERT INTO "ThrPayment" ("id", "employeeId", "year", "amount", "transactionId")
SELECT
    'thr_' || e."id",
    e."id",
    COALESCE(EXTRACT(YEAR FROM t."date")::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER),
    COALESCE(t."amount", 0),
    t."id"
FROM "Employee" e
LEFT JOIN LATERAL (
    SELECT tx."id", tx."date", tx."amount"
    FROM "Transaction" tx
    WHERE tx."desc" = 'Pembayaran THR — ' || e."name"
    ORDER BY tx."date" DESC
    LIMIT 1
) t ON TRUE
WHERE e."thrPaid" = TRUE;

ALTER TABLE "Employee" DROP COLUMN "thrPaid";
