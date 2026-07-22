// Aggregation helpers for the attendance performance report — separate from
// payroll.ts (unrelated subject, and that file is already sizeable).

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type AttendanceBucket = { key: string; label: string; hadir: number; izin: number; alpha: number; libur: number };

function emptyBucket(key: string, label: string): AttendanceBucket {
  return { key, label, hadir: 0, izin: 0, alpha: 0, libur: 0 };
}

function tally(bucket: AttendanceBucket, status: string) {
  if (status === "Hadir") bucket.hadir++;
  else if (status === "Izin") bucket.izin++;
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
  alpha: number;
  total: number;
};

export function employeeAttendanceSummary(
  employees: { id: string; name: string; site: { name: string }; position: { name: string } }[],
  records: { employeeId: string; date: Date; status: string }[],
  year: number,
): EmployeeAttendanceSummary[] {
  const byEmployee = new Map<string, { hadir: number; izin: number; alpha: number; total: number }>();
  for (const r of records) {
    if (r.date.getFullYear() !== year) continue;
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, { hadir: 0, izin: 0, alpha: 0, total: 0 });
    const s = byEmployee.get(r.employeeId)!;
    if (r.status === "Hadir") s.hadir++;
    else if (r.status === "Izin") s.izin++;
    else if (r.status === "Alpha") s.alpha++;
    if (r.status !== "Hari Libur") s.total++;
  }
  return employees.map((e) => {
    const s = byEmployee.get(e.id) ?? { hadir: 0, izin: 0, alpha: 0, total: 0 };
    return { employeeId: e.id, name: e.name, siteName: e.site.name, positionName: e.position.name, ...s };
  });
}
