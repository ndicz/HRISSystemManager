-- Rename discountAmount (Rupiah) to discountPercent (0-100) — the field
-- now represents a percentage of subtotal rather than a flat Rupiah figure,
-- so existing values (entered as Rupiah) are reset to 0 rather than kept,
-- since a stale value like "50000" would be nonsensical as a percentage.
ALTER TABLE "InvoiceBj" RENAME COLUMN "discountAmount" TO "discountPercent";
UPDATE "InvoiceBj" SET "discountPercent" = 0 WHERE "discountPercent" != 0;
