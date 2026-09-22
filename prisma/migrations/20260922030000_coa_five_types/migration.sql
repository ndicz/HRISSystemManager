-- Account.type moves from a 2-value "masuk"/"keluar" scheme to the standard
-- 5-category chart-of-accounts classification (aset/kewajiban/modal/
-- pendapatan/beban). No column shape changes (still a plain string) —
-- existing accounts are all genuinely revenue or expense accounts, so this
-- just renames their existing classification 1:1; it does not reclassify
-- any account into aset/kewajiban/modal.
UPDATE "Account" SET "type" = 'pendapatan' WHERE "type" = 'masuk';
UPDATE "Account" SET "type" = 'beban' WHERE "type" = 'keluar';
