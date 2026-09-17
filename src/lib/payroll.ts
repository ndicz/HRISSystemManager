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

// Payroll runs on a 21st–20th cycle, not the calendar month — set by
// request once the client's actual attendance cutoff moved to the 20th.
// This is deliberately scoped to payroll only: Kas/laporan keuangan and
// the general Absensi page keep using plain calendar months (monthKey)
// throughout this file and elsewhere, since those still close on the 1st.
const PAYROLL_CUTOFF_DAY = 21;

// The period label a date falls into — day 21 of a month through day 20
// of the next rolls into *that* next month's label (e.g. Aug 21–Sep 20 is
// period "Y-09"), mirroring how the client already talks about "periode
// September" for that same span.
export function payrollPeriodKey(d: Date): string {
  const shifted = new Date(d.getFullYear(), d.getMonth() + (d.getDate() >= PAYROLL_CUTOFF_DAY ? 1 : 0), 1);
  return shifted.getFullYear() + "-" + String(shifted.getMonth() + 1).padStart(2, "0");
}

// Inverse of payrollPeriodKey: the actual [start, end] calendar dates a
// period label covers. JS Date normalizes an out-of-range month index
// (e.g. month -1 for a January period's December start) into the correct
// adjacent year on its own.
export function payrollPeriodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number); // m is 1-indexed
  const start = new Date(y, m - 2, PAYROLL_CUTOFF_DAY, 0, 0, 0, 0);
  const end = new Date(y, m - 1, PAYROLL_CUTOFF_DAY - 1, 23, 59, 59, 999);
  return { start, end };
}

const PAYROLL_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// "21 Agu – 20 Sep 2026" — used anywhere a payroll period used to just show
// "September 2026" (period picker, slip gaji).
export function payrollPeriodLabel(period: string): string {
  const { start, end } = payrollPeriodRange(period);
  const startLabel = `${start.getDate()} ${PAYROLL_MONTH_ABBR[start.getMonth()]}`;
  const endLabel = `${end.getDate()} ${PAYROLL_MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`;
  return `${startLabel} – ${endLabel}`;
}

// A period picker's option list — rolling window relative to today instead
// of a year hardcoded into the option values, so the picker keeps working
// (and keeps offering the current period) without a code change every
// January. monthsBack/monthsForward count calendar months from now, not
// payroll periods, which is all that matters for how wide the window is.
export function payrollPeriodOptions(monthsBack = 12, monthsForward = 3): { value: string; label: string }[] {
  const now = new Date();
  const options = [];
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    options.push({ value, label: payrollPeriodLabel(value) });
  }
  return options;
}

// Same shape as monthlyAttendanceTally, but scoped to the payroll period's
// actual 21–20 date range instead of a calendar month.
export function payrollAttendanceTally(records: Pick<AttendanceRecord, "date" | "status" | "lateMin">[], period: string) {
  const { start, end } = payrollPeriodRange(period);
  const periodRecords = records.filter((r) => r.date >= start && r.date <= end);
  const presentDays = periodRecords.filter((r) => r.status === "Hadir").length;
  const leaveDays = periodRecords.filter((r) => r.status === "Izin").length;
  const alphaDays = periodRecords.filter((r) => r.status === "Alpha").length;
  const lateCount = periodRecords.filter((r) => r.lateMin > 0).length;
  return { presentDays, leaveDays, alphaDays, lateCount, workDays: presentDays + leaveDays + alphaDays };
}

// Same idea as bestAttendanceMonth, grouped by payroll period instead of
// calendar month — used to default the Penggajian period picker.
export function bestPayrollPeriod(records: Pick<AttendanceRecord, "date">[]): string | null {
  if (records.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = payrollPeriodKey(r.date);
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

// A lateness deduction table row: minMinutes–maxMinutes (maxMinutes null =
// no upper bound) maps to a flat Rp amount for that one late occurrence.
// scope narrows who it applies to; ties are broken most-specific-wins.
export type LatenessBracketLike = {
  scope: string; // "global" | "site" | "position" | "employee"
  siteId: string | null;
  positionId: string | null;
  employeeId: string | null;
  minMinutes: number;
  maxMinutes: number | null;
  amount: number;
};

// Employee-specific brackets win outright over position, which wins over
// site, which wins over the global default — never merged across scopes,
// so exactly one table applies to any given employee. Within that table,
// the first bracket whose range contains lateMin is used.
export function resolveLatenessAmount(
  brackets: LatenessBracketLike[],
  lateMin: number,
  ctx: { employeeId: string; positionId: string; siteId: string },
): number {
  if (lateMin <= 0) return 0;
  const byEmployee = brackets.filter((b) => b.scope === "employee" && b.employeeId === ctx.employeeId);
  const byPosition = brackets.filter((b) => b.scope === "position" && b.positionId === ctx.positionId);
  const bySite = brackets.filter((b) => b.scope === "site" && b.siteId === ctx.siteId);
  const byGlobal = brackets.filter((b) => b.scope === "global");
  const scoped = byEmployee.length > 0 ? byEmployee : byPosition.length > 0 ? byPosition : bySite.length > 0 ? bySite : byGlobal;
  const match = scoped.find((b) => lateMin >= b.minMinutes && (b.maxMinutes === null || lateMin <= b.maxMinutes));
  return match?.amount ?? 0;
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
  emp: Pick<Employee, "id" | "positionId" | "siteId" | "overtimeHours" | "kasbon" | "kasbonCicilan" | "bpjsKesehatanOverride" | "bpjsKetenagakerjaanOverride">,
  components: SalaryComponent[],
  records: Pick<AttendanceRecord, "date" | "status" | "lateMin">[],
  period: string,
  opts?: {
    rate?: PayrollRate | null;
    entry?: PayrollEntry | null;
    overtimeDays?: Pick<OvertimeDay, "type">[];
    assignments?: Pick<Assignment, "cost">[];
    latenessBrackets?: LatenessBracketLike[];
  },
) {
  const tally = payrollAttendanceTally(records, period);
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
  // A configured bracket table (minutes late -> Rp) takes over from the
  // flat per-occurrence terlambatRate entirely once any bracket exists
  // anywhere — resolveLatenessAmount itself picks the most specific table
  // (this employee, then their jabatan, then their tempat kerja, then the
  // global default) and prices each late day by its actual lateMin instead
  // of a single flat number per occurrence.
  const { start: periodStart, end: periodEnd } = payrollPeriodRange(period);
  const lateRecordsInPeriod = records.filter((r) => r.date >= periodStart && r.date <= periodEnd && r.lateMin > 0);
  const brackets = opts?.latenessBrackets ?? [];
  const potonganTerlambatAuto = brackets.length > 0
    ? lateRecordsInPeriod.reduce((sum, r) => sum + resolveLatenessAmount(brackets, r.lateMin, { employeeId: emp.id, positionId: emp.positionId, siteId: emp.siteId }), 0)
    : tally.lateCount * rate.terlambatRate;
  const potonganTerlambat = entry?.potonganTerlambatOverride ?? potonganTerlambatAuto;
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
  const period = payrollPeriodKey(resignDate);
  const filtered = records.filter((r) => payrollPeriodKey(r.date) === period && r.date <= resignDate);
  const tally = payrollAttendanceTally(filtered, period);
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
