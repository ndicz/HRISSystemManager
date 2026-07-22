"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { computeThr, computeMonthlyPayroll, resolvePayrollRate, resolveOvertimeDays, resolveAssignments } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { mapLimit } from "@/lib/concurrency";

export async function bayarThr(employeeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const emp = await db.employee.findUnique({ where: { id: employeeId }, include: { salaryComponents: true } });
  if (!emp || emp.thrPaid) return;

  const { thr } = computeThr(emp, emp.salaryComponents);
  const account = await db.account.findFirst({ where: { code: "5008" } });
  const cashAccount = await db.cashAccount.findFirst();

  if (account && cashAccount) {
    await db.transaction.create({
      data: {
        date: new Date(),
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Pembayaran THR — " + emp.name,
        amount: thr,
        type: "keluar",
      },
    });
  }

  await db.employee.update({ where: { id: employeeId }, data: { thrPaid: true } });
  await db.auditLog.create({ data: { userId: session.user.id, action: "thr.pay", entity: "Employee", entityId: employeeId } });

  revalidatePath("/penggajian");
  revalidatePath("/kas");
}

// Marks the regular monthly payroll run as paid — the one gap THR/Insentif
// didn't have: this never posted to Kas at all before. Idempotent against
// double-pay: any employee whose PayrollEntry.paid is already true for this
// period is silently skipped, so re-clicking "Bayar Gaji" for a site that's
// partially paid only pays the remainder.
export async function bayarGaji(employeeIds: string[], period: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!employeeIds || employeeIds.length === 0) throw new Error("Tidak ada karyawan untuk dibayar.");
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");

  const [y, m] = period.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);

  const [employees, rates, account, cashAccount] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        salaryComponents: true,
        payrollEntries: { where: { period } },
        overtimeDays: { where: { period } },
        assignments: { where: { period }, select: { cost: true, status: true, period: true } },
        attendance: { where: { date: { gte: monthStart, lt: monthEnd } }, select: { date: true, status: true, lateMin: true } },
      },
    }),
    db.payrollRate.findMany({ where: { period } }),
    db.account.findFirst({ where: { code: "5001" } }),
    db.cashAccount.findFirst(),
  ]);
  if (!account || !cashAccount) throw new Error("Akun kas / COA Gaji Karyawan belum tersedia — jalankan ulang seed.");

  let paid = 0;
  let skipped = 0;
  let total = 0;

  await mapLimit(employees, 8, async (emp) => {
    const existingEntry = emp.payrollEntries[0] ?? null;
    if (existingEntry?.paid) {
      skipped++;
      return;
    }

    const rate = resolvePayrollRate(rates, period, emp.siteId);
    const overtimeDays = resolveOvertimeDays(emp.overtimeDays, period);
    const assignments = resolveAssignments(emp.assignments, period);
    const p = computeMonthlyPayroll(emp, emp.salaryComponents, emp.attendance, period, { rate, entry: existingEntry, overtimeDays, assignments });

    const tx = await db.transaction.create({
      data: {
        date: new Date(),
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Gaji " + period + " — " + emp.name,
        amount: p.total,
        type: "keluar",
      },
    });

    await db.payrollEntry.upsert({
      where: { employeeId_period: { employeeId: emp.id, period } },
      update: { paid: true, paidTransactionId: tx.id },
      create: { employeeId: emp.id, period, paid: true, paidTransactionId: tx.id },
    });

    paid++;
    total += p.total;
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "payroll.pay", entity: "Employee", detail: JSON.stringify({ period, paid, skipped, total }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/kas");
  return { paid, skipped, total };
}

export async function savePayrollRate(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const period = String(formData.get("period") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");

  const int = (k: string) => Math.max(0, parseInt(String(formData.get(k) ?? "0"), 10) || 0);
  const data = {
    izinRate: int("izinRate"),
    alphaRate: int("alphaRate"),
    terlambatRate: int("terlambatRate"),
    lemburRegulerRate: int("lemburRegulerRate"),
    lemburMerahRate: int("lemburMerahRate"),
  };

  // Not a plain upsert on the composite unique key: Postgres treats every
  // NULL as distinct, so the (period, siteId=null) "default rate" row isn't
  // actually enforced unique at the DB level — look it up and branch instead.
  const existing = await db.payrollRate.findFirst({ where: { period, siteId } });
  if (existing) {
    await db.payrollRate.update({ where: { id: existing.id }, data });
  } else {
    await db.payrollRate.create({ data: { period, siteId, ...data } });
  }

  await db.auditLog.create({
    data: { userId: session.user.id, action: "payrollRate.save", entity: "PayrollRate", detail: JSON.stringify({ period, siteId, ...data }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

export async function savePayrollEntry(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const period = String(formData.get("period") ?? "");
  if (!employeeId || !/^\d{4}-\d{2}$/.test(period)) throw new Error("Data tidak valid.");

  const int = (k: string) => Math.max(0, parseInt(String(formData.get(k) ?? "0"), 10) || 0);
  // Blank = compute from attendance × rate as usual; a number = override
  // that one deduction category for this employee/period only.
  const intOrNull = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : null;
  };
  const note = String(formData.get("note") ?? "").trim() || null;
  const data = {
    allowance: int("allowance"),
    note,
    potonganIzinOverride: intOrNull("potonganIzinOverride"),
    potonganAlphaOverride: intOrNull("potonganAlphaOverride"),
    potonganTerlambatOverride: intOrNull("potonganTerlambatOverride"),
    lemburOverride: intOrNull("lemburOverride"),
  };

  await db.payrollEntry.upsert({
    where: { employeeId_period: { employeeId, period } },
    update: data,
    create: { employeeId, period, ...data },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "payrollEntry.save", entity: "Employee", entityId: employeeId, detail: JSON.stringify({ period }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

// Lets HR fix BPJS deduction directly from the payroll detail dialog
// instead of navigating to Karyawan — same override semantics as
// EditEmployeeDialog's BPJS fields (null = pakai rumus otomatis).
export async function updateBpjsOverride(employeeId: string, bpjsKesehatan: number | null, bpjsKetenagakerjaan: number | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!employeeId) throw new Error("Karyawan tidak ditemukan.");

  await db.employee.update({
    where: { id: employeeId },
    data: {
      bpjsKesehatanOverride: bpjsKesehatan !== null ? Math.max(0, bpjsKesehatan) : null,
      bpjsKetenagakerjaanOverride: bpjsKetenagakerjaan !== null ? Math.max(0, bpjsKetenagakerjaan) : null,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "employee.update", entity: "Employee", entityId: employeeId, detail: JSON.stringify({ bpjsKesehatan, bpjsKetenagakerjaan }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/karyawan");
}

// A single recorded overtime day (mis. lembur tanggal merah tgl 13) — the
// lembur line in payroll is priced by counting these per type, rather than
// a manually typed total, so HR records the actual dates worked.
export async function addOvertimeDay(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const dateRaw = String(formData.get("date") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!employeeId || !dateRaw) throw new Error("Tanggal wajib diisi.");
  if (type !== "reguler" && type !== "merah") throw new Error("Jenis lembur tidak valid.");

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal tidak valid.");
  const period = monthKey(date);

  await db.overtimeDay.create({ data: { employeeId, period, date, type, note } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "overtimeDay.add", entity: "Employee", entityId: employeeId, detail: JSON.stringify({ date: dateRaw, type }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

export async function removeOvertimeDay(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const day = await db.overtimeDay.findUnique({ where: { id } });
  if (!day) throw new Error("Data lembur tidak ditemukan.");

  await db.overtimeDay.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "overtimeDay.remove", entity: "Employee", entityId: day.employeeId, detail: JSON.stringify({ date: day.date, type: day.type }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

// Off-cycle bonus/incentive payment — deliberately separate from
// savePayrollEntry's allowance (which is folded into the monthly gaji-tgl-1
// total): this pays out immediately as its own cash transaction, on
// whatever date HR chooses, and never touches the monthly payroll figures.
// Batched: each row is a different employee with its own amount, sharing
// one desc/date — one Transaction + one AllowancePayment per row, so Kas
// detail stays granular per person even though it's one submission.
export async function payAllowanceBatch(rows: { employeeId: string; amount: number }[], desc: string | null, dateRaw: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!rows || rows.length === 0) throw new Error("Tidak ada baris untuk dibayar.");
  if (rows.some((r) => !r.employeeId || r.amount <= 0)) throw new Error("Setiap baris wajib punya karyawan dan jumlah > 0.");

  const date = dateRaw ? new Date(dateRaw) : new Date();
  const employees = await db.employee.findMany({ where: { id: { in: rows.map((r) => r.employeeId) } } });
  const empById = new Map(employees.map((e) => [e.id, e]));
  if (rows.some((r) => !empById.has(r.employeeId))) throw new Error("Salah satu karyawan tidak ditemukan.");

  const account = await db.account.findFirst({ where: { code: "5010" } });
  const cashAccount = await db.cashAccount.findFirst();
  if (!account || !cashAccount) throw new Error("Akun kas / COA Bonus-Insentif belum tersedia — jalankan ulang seed.");

  await mapLimit(rows, 8, async (row) => {
    const emp = empById.get(row.employeeId)!;
    const tx = await db.transaction.create({
      data: {
        date,
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Bonus/Insentif — " + emp.name + (desc ? " — " + desc : ""),
        amount: row.amount,
        type: "keluar",
      },
    });
    await db.allowancePayment.create({
      data: { employeeId: row.employeeId, date, amount: row.amount, desc, transactionId: tx.id, createdById: session.user.id },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "allowance.payBatch",
      entity: "Employee",
      detail: JSON.stringify({ count: rows.length, total: rows.reduce((s, r) => s + r.amount, 0), desc }),
    },
  });

  revalidatePath("/penggajian");
  revalidatePath("/kas");
}
