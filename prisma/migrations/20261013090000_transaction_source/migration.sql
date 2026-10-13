-- Mark transactions posted automatically by other modules, so Kas can stop
-- them from being edited by hand. Existing rows are tagged from the fixed
-- descriptions those modules write.
ALTER TABLE "Transaction" ADD COLUMN "source" TEXT;

UPDATE "Transaction" SET "source" = 'transfer' WHERE "isTransfer" = TRUE;
UPDATE "Transaction" SET "source" = 'gaji' WHERE "source" IS NULL AND "desc" ~ '^Gaji [0-9]{4}-[0-9]{2} — ';
UPDATE "Transaction" SET "source" = 'thr' WHERE "source" IS NULL AND "desc" LIKE 'Pembayaran THR — %';
UPDATE "Transaction" SET "source" = 'penugasan' WHERE "source" IS NULL AND "desc" LIKE 'Biaya Penugasan Tambahan — %';
UPDATE "Transaction" SET "source" = 'invoice' WHERE "source" IS NULL AND (
  "desc" ~ '^Pembayaran (OS-|[0-9]+-INV-)' OR "desc" LIKE 'Pembatalan invoice %' OR "desc" LIKE 'PPN Keluaran %' OR "desc" LIKE 'Pembatalan PPN Keluaran %'
);
UPDATE "Transaction" SET "source" = 'gudang' WHERE "source" IS NULL AND ("desc" LIKE 'Pengeluaran barang — %' OR "desc" LIKE 'Pembatalan pengambilan barang — %');
UPDATE "Transaction" SET "source" = 'hutang' WHERE "source" IS NULL AND "desc" LIKE 'Bayar hutang — %';
