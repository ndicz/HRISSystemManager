"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";

const CONFIRM_PHRASE = "HAPUS SEMUA DATA";

// Wipes every piece of business data (employees and everything that
// cascades from them, sites, positions, clients, invoices, cash/finance
// records, recruitment, audit history) back to an empty slate — but never
// touches User rows, so nobody gets locked out of their own login. Meant
// for clearing out test/dummy data before real use, not routine cleanup.
export async function resetAllData(confirmText: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Hanya admin yang bisa mereset data.");
  if (confirmText !== CONFIRM_PHRASE) throw new Error(`Teks konfirmasi tidak cocok. Ketik persis: ${CONFIRM_PHRASE}`);

  await db.$transaction([
    // Break the optional Employee link first so deleting employees below
    // never hits a foreign-key error on a linked login.
    db.user.updateMany({ data: { employeeId: null } }),
    db.transaction.deleteMany(),
    db.invoiceBjItem.deleteMany(),
    db.invoiceBj.deleteMany(),
    db.invoice.deleteMany(),
    // Cascades SalaryComponent, AttendanceRecord, LeaveRequest, Assignment.
    db.employee.deleteMany(),
    db.client.deleteMany(),
    db.site.deleteMany(),
    db.position.deleteMany(),
    db.candidate.deleteMany(),
    db.account.deleteMany(),
    db.cashAccount.deleteMany(),
    db.payable.deleteMany(),
    db.closedPeriod.deleteMany(),
    db.auditLog.deleteMany(),
  ]);
}
