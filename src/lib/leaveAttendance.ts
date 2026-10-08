import type { LeaveRequest } from "@prisma/client";
import { recomputeEmployeeAttendance, type Tx } from "@/lib/attendanceAggregate";

// Leave type → the attendance status it fills in (all three are paid,
// no-deduction days — see isLeaveStatus).
export function leaveAttendanceStatus(type: string): "Sakit" | "Izin" | "Cuti" {
  if (type === "Sakit") return "Sakit";
  if (type === "Lainnya") return "Izin";
  return "Cuti";
}

// Every calendar day of the request, as the local-midnight dates
// AttendanceRecord uses (absensi stores "YYYY-MM-DD" + T00:00:00).
function leaveDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const last = new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (d <= last) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Brings the absensi days a leave request filled in back in line with the
// request as it stands now: the days it added earlier are removed, and if
// it is (still) approved its days are filled in again. Days that already
// had a record — imported or corrected by hand — are never overwritten.
export async function syncLeaveAttendance(tx: Tx, leave: Pick<LeaveRequest, "id" | "employeeId" | "type" | "startDate" | "endDate" | "status">) {
  await tx.attendanceRecord.deleteMany({ where: { leaveRequestId: leave.id } });
  if (leave.status === "disetujui") {
    const status = leaveAttendanceStatus(leave.type);
    await tx.attendanceRecord.createMany({
      data: leaveDays(leave.startDate, leave.endDate).map((date) => ({ employeeId: leave.employeeId, date, status, leaveRequestId: leave.id })),
      skipDuplicates: true,
    });
  }
  await recomputeEmployeeAttendance(tx, leave.employeeId);
}
