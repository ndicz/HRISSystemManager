import type { Assignment, AttendanceRecord, Employee, OvertimeDay, PayrollEntry, PayrollRate, SalaryComponent, Site } from "@prisma/client";
import { monthKey } from "@/lib/finance";

export function formatRp(n: number) {
  const r = Math.round(n);
  return (r < 0 ? "-Rp" : "Rp") + Math.abs(r).toLocaleString("id-ID");
}

export function baseSalary(components: SalaryComponent[]): number {
  return components.reduce((sum, c) => sum + c.amount, 0);
}

// A kasbon (salary advance) can be repaid over several months instead of
// deducted in full at once — kasbonCicilan is how many months to spread it
// across (1 = the whole balance comes out immediately, the old behavior).
export function kasbonPerBulan(kasbon: number, kasbonCicilan: number): number {
  return kasbonCicilan > 1 ? Math.ceil(kasbon / kasbonCicilan) : kasbon;
}

export function computePayroll(
  emp: Pick<
    Employee,
    "workDays" | "presentDays" | "leaveDays" | "overtimeHours" | "kasbon" | "kasbonCicilan"
    | "bpjsKesehatanOverride" | "bpjsKetenagakerjaanOverride"
  >,
  components: SalaryComponent[],
) {
  const base = baseSalary(components);
  const paidDays = emp.presentDays + emp.leaveDays;
  const effective = emp.workDays > 0 ? Math.round((base * paidDays) / emp.workDays) : base;
  const potonganAbsensi = base - effective;
  const lemburRate = Math.round(base / 173 * 1.5);
  const lembur = emp.overtimeHours * lemburRate;
  // null override = use the standard formula; a set override lets HR correct
  // cases where the formula doesn't match what's actually being deducted.
  const bpjsKesehatan = emp.bpjsKesehatanOverride ?? computeBpjsKesehatan(base).karyawan;
  const bpjsKetenagakerjaan = emp.bpjsKetenagakerjaanOverride ?? computeBpjsKetenagakerjaanKaryawan(base);
  const bpjs = bpjsKesehatan + bpjsKetenagakerjaan;
  const kasbonBulanIni = kasbonPerBulan(emp.kasbon, emp.kasbonCicilan);
  const potongan = potonganAbsensi + bpjs + kasbonBulanIni;
  const total = base - potongan + lembur;
  return { gajiPokok: base, potonganAbsensi, bpjs, bpjsKesehatan, bpjsKetenagakerjaan, kasbonBulanIni, lembur, potongan, total };
}

// Tallies a specific month's presentDays/leaveDays/workDays straight from
// day-level AttendanceRecord rows (which carry real dates), instead of the
// Employee's live aggregate columns — those only ever reflect whichever
// month currently has the most imported records, so they can't answer
// "what did October look like" once November's import has landed.
export function monthlyAttendanceTally(records: Pick<AttendanceRecord, "date" | "status" | "lateMin">[], period: string) {
  const monthRecords = records.filter((r) => monthKey(r.date) === period);
  const presentDays = monthRecords.filter((r) => r.status === "Hadir").length;
  const leaveDays = monthRecords.filter((r) => r.status === "Izin").length;
  const alphaDays = monthRecords.filter((r) => r.status === "Alpha").length;
  const lateCount = monthRecords.filter((r) => r.lateMin > 0).length;
  return { presentDays, leaveDays, alphaDays, lateCount, workDays: presentDays + leaveDays + alphaDays };
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
//
// When opts.rate is provided (a PayrollRate has been configured for the
// period), Izin/Alpha/Terlambat deductions and overtime/allowance are
// computed from flat per-occurrence rates instead of computePayroll's
// proportional-to-salary math — matching how the client's real payroll
// spreadsheet works. Without a configured rate, behavior is unchanged.
export function computeMonthlyPayroll(
  emp: Pick<Employee, "overtimeHours" | "kasbon" | "kasbonCicilan" | "bpjsKesehatanOverride" | "bpjsKetenagakerjaanOverride">,
  components: SalaryComponent[],
  records: Pick<AttendanceRecord, "date" | "status" | "lateMin">[],
  period: string,
  opts?: { rate?: PayrollRate | null; entry?: PayrollEntry | null; overtimeDays?: Pick<OvertimeDay, "type">[]; assignments?: Pick<Assignment, "cost">[] },
) {
  const tally = monthlyAttendanceTally(records, period);
  const base = computePayroll(
    {
      ...tally,
      overtimeHours: emp.overtimeHours,
      kasbon: emp.kasbon,
      kasbonCicilan: emp.kasbonCicilan,
      bpjsKesehatanOverride: emp.bpjsKesehatanOverride,
      bpjsKetenagakerjaanOverride: emp.bpjsKetenagakerjaanOverride,
    },
    components,
  );
  const entry = opts?.entry;

  // Completed Penugasan Tambahan for this period — earned pay on top of
  // the regular run, independent of whether a flat PayrollRate is set. A
  // manual override replaces the assignments-sum figure entirely, same
  // swap-before-total semantics as the other override fields below.
  const autoPenugasanTambahan = (opts?.assignments ?? []).reduce((s, a) => s + a.cost, 0);
  const penugasanTambahan = entry?.penugasanTambahanOverride ?? autoPenugasanTambahan;

  // Gaji pokok and kasbon deduction both default to the formula-derived
  // figure but can be corrected by hand — same override pattern as
  // lembur/potongan below. These only replace the number shown/paid; they
  // don't cascade into other computed lines (e.g. an overridden gaji pokok
  // doesn't retroactively change potongan absensi), keeping each override
  // a simple, predictable substitution.
  const gajiPokok = entry?.gajiPokokOverride ?? base.gajiPokok;
  const kasbonBulanIni = entry?.kasbonOverride ?? base.kasbonBulanIni;

  // Counted from the specific dates HR recorded (via "tanggal lembur"), not
  // a manually typed total — the dates are the source of truth either way,
  // with or without a PayrollRate configured for the period.
  const overtimeDays = opts?.overtimeDays ?? [];
  const lemburRegulerCount = overtimeDays.filter((d) => d.type === "reguler").length;
  const lemburMerahCount = overtimeDays.filter((d) => d.type === "merah").length;

  if (!opts?.rate) {
    // No flat PayrollRate for this period — lembur used to silently come
    // from Employee.overtimeHours (a stale field completely disconnected
    // from OvertimeDay, so entering overtime dates had zero effect on the
    // total). Now it's derived from those same recorded dates instead,
    // priced at this employee's own proportional hourly rate (8h/day,
    // tanggal merah at 2x — the standard holiday-overtime premium) so it
    // always reflects what was actually entered. A manual override (rates
    // genuinely differ per person) replaces this figure entirely.
    const lemburRatePerJam = Math.round(base.gajiPokok / 173 * 1.5);
    const autoLembur = lemburRegulerCount * 8 * lemburRatePerJam + lemburMerahCount * 8 * lemburRatePerJam * 2;
    const lembur = entry?.lemburOverride ?? autoLembur;
    const potonganAbsensi = entry?.potonganAbsensiOverride ?? base.potonganAbsensi;
    const potongan = potonganAbsensi + base.bpjs + kasbonBulanIni;
    const total = gajiPokok - potongan + lembur + penugasanTambahan;
    return {
      ...base,
      gajiPokok, potonganAbsensi, kasbonBulanIni, potongan,
      lembur, total,
      potonganIzin: 0, potonganAlpha: 0, potonganTerlambat: 0,
      lemburReguler: 0, lemburMerah: 0, allowance: 0, penugasanTambahan,
      usesFlatRate: false as const,
    };
  }

  const { rate } = opts;
  // A per-employee-per-period override (set via the "Lembur & Allowance"
  // dialog) replaces the attendance×rate calculation entirely for that one
  // category, for cases HR needs to correct by hand.
  const potonganIzin = entry?.potonganIzinOverride ?? tally.leaveDays * rate.izinRate;
  const potonganAlpha = entry?.potonganAlphaOverride ?? tally.alphaDays * rate.alphaRate;
  const potonganTerlambat = entry?.potonganTerlambatOverride ?? tally.lateCount * rate.terlambatRate;
  const lemburReguler = lemburRegulerCount * rate.lemburRegulerRate;
  const lemburMerah = lemburMerahCount * rate.lemburMerahRate;
  const allowance = entry?.allowance ?? 0;
  // Rates genuinely differ per person in practice — a manual override (Rp)
  // replaces the reguler+merah×rate figure entirely when HR sets one.
  const lembur = entry?.lemburOverride ?? (lemburReguler + lemburMerah);
  const potongan = potonganIzin + potonganAlpha + potonganTerlambat + base.bpjs + kasbonBulanIni;
  const total = gajiPokok - potongan + lembur + allowance + penugasanTambahan;

  return {
    gajiPokok,
    potonganAbsensi: 0,
    potonganIzin, potonganAlpha, potonganTerlambat,
    bpjs: base.bpjs,
    bpjsKesehatan: base.bpjsKesehatan,
    bpjsKetenagakerjaan: base.bpjsKetenagakerjaan,
    kasbonBulanIni,
    lembur, lemburReguler, lemburMerah, allowance, penugasanTambahan,
    potongan, total,
    usesFlatRate: true as const,
  };
}

// Rate resolution: a per-site override for the period wins; otherwise the
// period's default (siteId null) rate; otherwise no rate is configured.
export function resolvePayrollRate(rates: PayrollRate[], period: string, siteId: string): PayrollRate | null {
  return rates.find((r) => r.period === period && r.siteId === siteId)
    ?? rates.find((r) => r.period === period && r.siteId === null)
    ?? null;
}

export function resolvePayrollEntry(entries: PayrollEntry[], period: string): PayrollEntry | null {
  return entries.find((e) => e.period === period) ?? null;
}

export function resolveOvertimeDays(days: OvertimeDay[], period: string): OvertimeDay[] {
  return days.filter((d) => d.period === period);
}

// Only "selesai" (completed) assignments count — same rule Kas already
// follows (completeAssignment only posts a Transaction on completion), so
// a still-"berjalan" assignment shouldn't show up as earned pay yet.
export function resolveAssignments<T extends Pick<Assignment, "cost" | "status" | "period">>(assignments: T[], period: string): T[] {
  return assignments.filter((a) => a.period === period && a.status === "selesai");
}

// Final settlement for a departing employee: prorates pay to the actual
// resignDate within that month (not a full month), and deducts the FULL
// outstanding kasbon (kasbonCicilan: 1 forces kasbonPerBulan to return the
// whole balance) instead of just this month's installment, since there's
// no future paycheck left to keep collecting it from.
export function computeFinalSettlement(
  emp: Pick<Employee, "overtimeHours" | "kasbon" | "kasbonCicilan" | "bpjsKesehatanOverride" | "bpjsKetenagakerjaanOverride">,
  components: SalaryComponent[],
  records: Pick<AttendanceRecord, "date" | "status" | "lateMin">[],
  resignDate: Date,
) {
  const period = monthKey(resignDate);
  const filtered = records.filter((r) => monthKey(r.date) === period && r.date <= resignDate);
  const tally = monthlyAttendanceTally(filtered, period);
  const result = computePayroll(
    {
      ...tally,
      overtimeHours: emp.overtimeHours,
      kasbon: emp.kasbon,
      kasbonCicilan: 1,
      bpjsKesehatanOverride: emp.bpjsKesehatanOverride,
      bpjsKetenagakerjaanOverride: emp.bpjsKetenagakerjaanOverride,
    },
    components,
  );
  return { ...result, period };
}

// Employees whose PKWT contract ends within `days` days from now (or has
// already passed), soonest/most-overdue first — for a dashboard reminder,
// since there's no email/SMS notification infra in this app.
export function expiringContracts(
  employees: (Pick<Employee, "id" | "name" | "contractEnd"> & { site: Pick<Site, "name"> })[],
  days = 30,
  ref: Date = new Date(),
) {
  return employees
    .filter((e): e is typeof e & { contractEnd: Date } => e.contractEnd != null)
    .map((e) => ({
      id: e.id,
      name: e.name,
      siteName: e.site.name,
      contractEnd: e.contractEnd,
      daysRemaining: Math.ceil((e.contractEnd.getTime() - ref.getTime()) / 86400000),
    }))
    .filter((e) => e.daysRemaining <= days)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
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

// Employee-side BPJS Ketenagakerjaan: JHT 2% + JP 1%, uncapped (same
// simplification level as computeUmr's uncapped 8.54% company-side figure).
export function computeBpjsKetenagakerjaanKaryawan(gajiPokok: number): number {
  return Math.round(gajiPokok * 0.03);
}
