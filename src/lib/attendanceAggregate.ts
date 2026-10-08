import type { PrismaClient } from "@prisma/client";
import { isLeaveStatus } from "@/lib/payroll";

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Recomputes an employee's attendance aggregate (presentDays, leaveDays,
// workDays used by computePayroll's absence deduction) from its
// AttendanceRecord rows. Scoped to whichever calendar month actually holds
// most of that employee's records — NOT the month of whatever date was
// just edited. A single stray correction dated outside the imported period
// (e.g. the "tambah/koreksi" form defaulting to today) must not collapse
// the aggregate down to "1/1"; the substantive imported month should stay
// authoritative until it, in turn, has fewer records than some other month.
export async function recomputeEmployeeAttendance(tx: Tx, employeeId: string) {
  const allRecords = await tx.attendanceRecord.findMany({ where: { employeeId }, orderBy: { date: "asc" } });
  if (allRecords.length === 0) return;

  const buckets = new Map<string, typeof allRecords>();
  for (const r of allRecords) {
    const key = r.date.getFullYear() + "-" + r.date.getMonth();
    const bucket = buckets.get(key);
    if (bucket) bucket.push(r);
    else buckets.set(key, [r]);
  }

  let bestRecords: typeof allRecords = [];
  for (const recs of buckets.values()) {
    if (recs.length > bestRecords.length) bestRecords = recs;
  }

  const hadir = bestRecords.filter((r) => r.status === "Hadir").length;
  const izin = bestRecords.filter((r) => isLeaveStatus(r.status)).length;
  const alpha = bestRecords.filter((r) => r.status === "Alpha").length;
  const workDays = hadir + izin + alpha;

  const latestOverall = allRecords[allRecords.length - 1];
  const attStatus = latestOverall.status;

  const existing = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });

  await tx.employee.update({
    where: { id: employeeId },
    data: {
      attStatus,
      checkIn: latestOverall.checkIn ?? (attStatus === "Hadir" ? "07:00" : "-"),
      checkOut: latestOverall.checkOut ?? (attStatus === "Hadir" ? "16:00" : "-"),
      presentDays: hadir,
      leaveDays: izin,
      workDays: workDays || existing.workDays,
    },
  });
}

