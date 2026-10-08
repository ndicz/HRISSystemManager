import { UserError } from "@/lib/userError";
import { db } from "@/lib/db";
import { monthKey } from "@/lib/finance";

// "Tutup periode" (Pengeluaran & Kas) freezes a calendar month's Kas
// entries for bookkeeping. Every module that posts a Transaction —
// Kas itself, but also payroll, THR, penugasan, invoices and gudang —
// has to go through this, otherwise money lands in a month that was
// already closed and reconciled.
export async function assertPeriodOpen(date: Date = new Date()) {
  const period = monthKey(date);
  const closed = await db.closedPeriod.findUnique({ where: { period } });
  if (closed) throw new UserError(`Periode ${period} sudah ditutup — buka kembali periode tersebut dulu di Pengeluaran & Kas untuk mencatat transaksi baru.`);
}
