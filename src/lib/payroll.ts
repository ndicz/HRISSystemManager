import type { AttendanceRecord, Employee, SalaryComponent } from "@prisma/client";
import { monthKey } from "@/lib/finance";

export function formatRp(n: number) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function baseSalary(components: SalaryComponent[]): number {
  return components.reduce((sum, c) => sum + c.amount, 0);
}

export function computePayroll(
  emp: Pick<Employee, "workDays" | "presentDays" | "leaveDays" | "overtimeHours" | "kasbon">,
  components: SalaryComponent[],
) {
  const base = baseSalary(components);
  const paidDays = emp.presentDays + emp.leaveDays;
  const effective = emp.workDays > 0 ? Math.round((base * paidDays) / emp.workDays) : base;
  const potonganAbsensi = base - effective;
  const lemburRate = Math.round(base / 173 * 1.5);
  const lembur = emp.overtimeHours * lemburRate;
  const bpjs = Math.round(base * 0.04);
  const potongan = potonganAbsensi + bpjs + emp.kasbon;
  const total = base - potongan + lembur;
  return { gajiPokok: base, potonganAbsensi, bpjs, lembur, potongan, total };
}

// Tallies a specific month's presentDays/leaveDays/workDays straight from
// day-level AttendanceRecord rows (which carry real dates), instead of the
// Employee's live aggregate columns — those only ever reflect whichever
// month currently has the most imported records, so they can't answer
// "what did October look like" once November's import has landed.
export function monthlyAttendanceTally(records: Pick<AttendanceRecord, "date" | "status">[], period: string) {
  const monthRecords = records.filter((r) => monthKey(r.date) === period);
  const presentDays = monthRecords.filter((r) => r.status === "Hadir").length;
  const leaveDays = monthRecords.filter((r) => r.status === "Izin").length;
  const alpha = monthRecords.filter((r) => r.status === "Alpha").length;
  return { presentDays, leaveDays, workDays: presentDays + leaveDays + alpha };
}

// Picks the month that actually has attendance data — the same
// most-records-wins rule absensi/actions.ts uses to keep the employee's
// live aggregate stable — so a period picker can default to "the month
// that was just imported" instead of blindly defaulting to today's real
// calendar month, which is usually empty right after an import.
export function bestAttendanceMonth(records: Pick<AttendanceRecord, "date">[]): string | null {
  if (records.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = monthKey(r.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

// computePayroll scoped to one specific month's actual attendance, rather
// than the employee's live/current aggregate — overtimeHours and kasbon
// aren't tracked per month in this schema, so those still come from the
// employee's current values.
export function computeMonthlyPayroll(
  emp: Pick<Employee, "overtimeHours" | "kasbon">,
  components: SalaryComponent[],
  records: Pick<AttendanceRecord, "date" | "status">[],
  period: string,
) {
  const tally = monthlyAttendanceTally(records, period);
  return computePayroll({ ...tally, overtimeHours: emp.overtimeHours, kasbon: emp.kasbon }, components);
}

export function tenureMonths(hireDate: Date, ref: Date = new Date()): number {
  return Math.max(0, (ref.getFullYear() - hireDate.getFullYear()) * 12 + (ref.getMonth() - hireDate.getMonth()));
}

export function computeThr(
  emp: Pick<Employee, "hireDate" | "thrOverride">,
  components: SalaryComponent[],
) {
  if (emp.thrOverride != null) return { thr: emp.thrOverride, months: tenureMonths(emp.hireDate) };
  const base = baseSalary(components);
  const months = tenureMonths(emp.hireDate);
  const thr = months >= 12 ? base : Math.round((base * months) / 12);
  return { thr, months };
}

// PPh 21 — UU HPP progressive brackets, PTKP TK/0 assumption.
export function pph21Annual(pkp: number): number {
  const brackets: [number, number][] = [
    [60000000, 0.05],
    [190000000, 0.15],
    [250000000, 0.25],
    [4500000000, 0.3],
    [Infinity, 0.35],
  ];
  let tax = 0;
  let remaining = pkp;
  for (const [size, rate] of brackets) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, size);
    tax += taxable * rate;
    remaining -= taxable;
  }
  return tax;
}

export function computeTax(gajiPokok: number, lembur: number) {
  const brutoBulan = gajiPokok + lembur;
  const brutoTahun = brutoBulan * 12;
  const biayaJabatan = Math.min(brutoTahun * 0.05, 6000000);
  const ptkp = 54000000;
  const pkp = Math.max(0, brutoTahun - biayaJabatan - ptkp);
  const pph21Bulan = pph21Annual(pkp) / 12;
  return { brutoBulan, pkp, pph21Bulan };
}

export function computeUmr(gajiPokok: number, umr: number) {
  const compliant = gajiPokok >= umr;
  const bpjsTk = gajiPokok * 0.0854;
  return { compliant, bpjsTk };
}

export function computeBpjsKesehatan(gajiPokok: number) {
  const base = Math.min(gajiPokok, 12000000);
  return { perusahaan: Math.round(base * 0.04), karyawan: Math.round(base * 0.01) };
}
