-- Freeze the computed payroll of a paid period (see PayrollEntry.paidSnapshot).
ALTER TABLE "PayrollEntry" ADD COLUMN "paidSnapshot" JSONB;
