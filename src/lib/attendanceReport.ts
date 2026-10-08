// Aggregation helpers for the attendance performance report — separate from
// payroll.ts (unrelated subject, and that file is already sizeable).

import { isLeaveStatus } from "@/lib/payroll";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type AttendanceBucket = { key: string; label: string; hadir: number; izin: number; alpha: number; libur: number };

function emptyBucket(key: string, label: string): AttendanceBucket {
  return { key, label, hadir: 0, izin: 0, alpha: 0, libur: 0 };
}

// "izin" here covers Izin/Sakit/Cuti as one reporting bucket — same
// no-deduction group payroll treats them as (see isLeaveStatus); each day's
// specific reason still shows correctly on its own record in Rekap
// Absensi, this is just the rolled-up chart/summary view.
function tally(bucket: AttendanceBucket, status: string) {
  if (status === "Hadir") bucket.hadir++;
  else if (isLeaveStatus(status)) bucket.izin++;
  else if (status === "Alpha") bucket.alpha++;
  else if (status === "Hari Libur") bucket.libur++;
}

export function monthlyAttendanceBuckets(records: { date: Date; status: string }[], year: number): AttendanceBucket[] {
  const buckets = MONTH_NAMES.map((label, i) => emptyBucket(`${year}-${String(i + 1).padStart(2, "0")}`, label));
  for (const r of records) {
    if (r.date.getFullYear() !== year) continue;
    tally(buckets[r.date.getMonth()], r.status);
  }
  return buckets;
}

export function yearlyAttendanceBuckets(records: { date: Date; status: string }[]): AttendanceBucket[] {
  const map = new Map<number, AttendanceBucket>();
  for (const r of records) {
    const year = r.date.getFullYear();
    if (!map.has(year)) map.set(year, emptyBucket(String(year), String(year)));
    tally(map.get(year)!, r.status);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, bucket]) => bucket);
}

export type EmployeeAttendanceSummary = {
  employeeId: string;
  name: string;
  siteName: string;
  positionName: string;
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpha: number;
  total: number;
};

export function employeeAttendanceSummary(
  employees: { id: string; name: string; site: { name: string }; position: { name: string } }[],
  records: { employeeId: string; date: Date; status: string }[],
  year: number,
): EmployeeAttendanceSummary[] {
  const byEmployee = new Map<string, { hadir: number; izin: number; sakit: number; cuti: number; alpha: number; total: number }>();
  for (const r of records) {
    if (r.date.getFullYear() !== year) continue;
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, { hadir: 0, izin: 0, sakit: 0, cuti: 0, alpha: 0, total: 0 });
    const s = byEmployee.get(r.employeeId)!;
    // Per person the three leave reasons are told apart; the chart above
    // still rolls them into one "Izin/Sakit/Cuti" bar.
    if (r.status === "Hadir") s.hadir++;
    else if (r.status === "Sakit") s.sakit++;
    else if (r.status === "Cuti") s.cuti++;
    else if (isLeaveStatus(r.status)) s.izin++;
    else if (r.status === "Alpha") s.alpha++;
    if (r.status !== "Hari Libur") s.total++;
  }
  return employees.map((e) => {
    const s = byEmployee.get(e.id) ?? { hadir: 0, izin: 0, sakit: 0, cuti: 0, alpha: 0, total: 0 };
    return { employeeId: e.id, name: e.name, siteName: e.site.name, positionName: e.position.name, ...s };
  });
}
