"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { computeThr, computeMonthlyPayroll, resolvePayrollRate, resolveOvertimeDays, resolveAssignments, payrollPeriodKey, payrollPeriodRange } from "@/lib/payroll";
import { mapLimit } from "@/lib/concurrency";

// Audit trail writes are best-effort — losing one to a transient DB hiccup
// should never block, or silently half-complete, the actual mutation it's
// describing (bayarGaji already writes the Transaction + PayrollEntry
// before this runs; a crash here must not make a real payment look like it
// failed). Every db.auditLog.create in this file goes through this.
async function logAudit(args: Parameters<typeof db.auditLog.create>[0]) {
  try {
    await db.auditLog.create(args);
  } catch (err) {
    console.error("[audit] failed to record", args.data?.action, err);
  }
}

export async function bayarThr(employeeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const emp = await db.employee.findUnique({ where: { id: employeeId }, include: { salaryComponents: true } });
  if (!emp || emp.thrPaid) return;

  const { thr } = computeThr(emp, emp.salaryComponents);
  // Same self-heal as bayarGaji's "Gaji Karyawan" category below — a
  // missing COA label is harmless to recreate, unlike the CashAccount.
  let account = await db.account.findFirst({ where: { code: "5008" } });
  if (!account) {
    try {
      account = await db.account.create({ data: { code: "5008", name: "Beban THR", type: "keluar" } });
    } catch {
      account = await db.account.findFirst({ where: { code: "5008" } });
    }
  }
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });

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
  await logAudit({ data: { userId: session.user.id, action: "thr.pay", entity: "Employee", entityId: employeeId } });

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

  let paid = 0;
  let skipped = 0;
  let total = 0;
  // One employee's data blowing up (a bad DB write, an unexpected constraint
  // violation, whatever) used to take the whole batch down with it — 96
  // people who paid fine looked exactly like 97 people who didn't, and the
  // generic redacted error gave no way to tell which was which. Now a
  // per-employee failure is caught, recorded, and the rest of the batch
  // keeps going.
  const failed: { name: string; reason: string }[] = [];

  // Next.js redacts any THROWN error's real message in production — the
  // client only ever sees the generic "Server Components render" text
  // (formatActionError's digest is the only trace left). Per Next's own
  // guidance, an "expected" failure here should be a return value instead
  // of a throw, so wrap everything past basic validation and surface
  // whatever actually broke as a real, readable message.
  try {
    const { start: periodStart, end: periodEnd } = payrollPeriodRange(period);

    const [employees, rates, brackets, existingAccount, cashAccount] = await Promise.all([
      db.employee.findMany({
        where: { id: { in: employeeIds } },
        include: {
          salaryComponents: true,
          payrollEntries: { where: { period } },
          overtimeDays: { where: { period } },
          assignments: { where: { period }, select: { cost: true, status: true, period: true } },
          attendance: { where: { date: { gte: periodStart, lte: periodEnd } }, select: { date: true, status: true, lateMin: true } },
          site: { select: { bpjsKesehatanOverride: true, bpjsKetenagakerjaanOverride: true } },
        },
      }),
      db.payrollRate.findMany({ where: { period } }),
      db.latenessBracket.findMany(),
      db.account.findFirst({ where: { code: "5001" } }),
      db.cashAccount.findFirst({ where: { kind: "besar" } }),
    ]);
    if (!cashAccount) {
      // Unlike the COA category below, a CashAccount is a real bank/cash
      // account with a real opening balance — guessing one here would
      // quietly corrupt actual Kas figures, so this one always needs a
      // person to add it (with the real balance) rather than being
      // auto-created.
      return {
        paid, skipped, total, failed,
        fatalError: "Belum ada rekening kas jenis \"Kas besar\" — tambahkan dulu di halaman Pengeluaran & Kas dengan tombol \"+ Rekening baru\" (pilih \"Kas besar (rekening bank)\"), lalu coba lagi.",
      };
    }
    // "Gaji Karyawan" (code 5001) is just an expense category label, not
    // real money — safe to recreate automatically if it's missing (e.g.
    // production was never fully seeded) instead of blocking every payroll
    // run on it. code is @unique, so a concurrent bayarGaji call hitting
    // the same gap could race on the create — fall back to a fresh lookup
    // rather than surfacing that as a failure.
    let account = existingAccount;
    if (!account) {
      try {
        account = await db.account.create({ data: { code: "5001", name: "Gaji Karyawan", type: "keluar", budget: 200000000 } });
      } catch {
        account = await db.account.findFirst({ where: { code: "5001" } });
      }
    }
    if (!account) {
      return { paid, skipped, total, failed, fatalError: "Gagal membuat kategori akun Gaji Karyawan (kode 5001) — coba lagi." };
    }

    await mapLimit(employees, 8, async (emp) => {
      try {
        const existingEntry = emp.payrollEntries[0] ?? null;
        if (existingEntry?.paid) {
          skipped++;
          return;
        }

        const rate = resolvePayrollRate(rates, period, emp.siteId);
        const overtimeDays = resolveOvertimeDays(emp.overtimeDays, period);
        const assignments = resolveAssignments(emp.assignments, period);
        const p = computeMonthlyPayroll(emp, emp.salaryComponents, emp.attendance, period, { rate, entry: existingEntry, overtimeDays, assignments, latenessBrackets: brackets, site: emp.site });

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
      } catch (err) {
        failed.push({ name: emp.name, reason: err instanceof Error ? err.message : String(err) });
      }
    });

    await logAudit({
      data: { userId: session.user.id, action: "payroll.pay", entity: "Employee", detail: JSON.stringify({ period, paid, skipped, total, failed }) },
    });

    revalidatePath("/penggajian");
    revalidatePath("/kas");
  } catch (err) {
    return { paid, skipped, total, failed, fatalError: err instanceof Error ? err.message : String(err) };
  }

  return { paid, skipped, total, failed };
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

  await logAudit({
    data: { userId: session.user.id, action: "payrollRate.save", entity: "PayrollRate", detail: JSON.stringify({ period, siteId, ...data }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

// Removes a configured rate entirely — the period/site combination just
// falls back to "no rate configured" (proportional deduction math) again,
// same as before it was ever set.
export async function deletePayrollRate(period: string, siteId: string | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await db.payrollRate.findFirst({ where: { period, siteId } });
  if (!existing) return;

  await db.payrollRate.delete({ where: { id: existing.id } });

  await logAudit({
    data: { userId: session.user.id, action: "payrollRate.delete", entity: "PayrollRate", detail: JSON.stringify({ period, siteId }) },
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

  await logAudit({
    data: { userId: session.user.id, action: "payrollEntry.save", entity: "Employee", entityId: employeeId, detail: JSON.stringify({ period }) },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

// Inline overrides from the Ringkasan tab of the payroll detail dialog —
// a separate, narrowly-scoped upsert (mirrors updateBpjsOverride below)
// rather than reusing savePayrollEntry: that action's form lives on a
// different tab and doesn't carry these fields, so folding this into it
// would null out gajiPokok/potonganAbsensi/penugasanTambahan/kasbon
// overrides on every "Lembur & Potongan" save (and vice versa).
export async function updatePayrollAmounts(
  employeeId: string,
  period: string,
  amounts: { gajiPokokOverride: number | null; potonganAbsensiOverride: number | null; penugasanTambahanOverride: number | null; kasbonOverride: number | null },
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!employeeId || !/^\d{4}-\d{2}$/.test(period)) throw new Error("Data tidak valid.");

  const clamp = (n: number | null) => (n !== null ? Math.max(0, n) : null);
  const data = {
    gajiPokokOverride: clamp(amounts.gajiPokokOverride),
    potonganAbsensiOverride: clamp(amounts.potonganAbsensiOverride),
    penugasanTambahanOverride: clamp(amounts.penugasanTambahanOverride),
    kasbonOverride: clamp(amounts.kasbonOverride),
  };

  await db.payrollEntry.upsert({
    where: { employeeId_period: { employeeId, period } },
    update: data,
    create: { employeeId, period, ...data },
  });

  await logAudit({
    data: { userId: session.user.id, action: "payrollEntry.amounts", entity: "Employee", entityId: employeeId, detail: JSON.stringify({ period, ...data }) },
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

  await logAudit({
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
  const period = payrollPeriodKey(date);

  await db.overtimeDay.create({ data: { employeeId, period, date, type, note } });

  await logAudit({
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

  await logAudit({
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
// Bonus now folds straight into the monthly gaji run instead of paying out
// as its own off-cycle Kas transaction — sets PayrollEntry.allowance for
// each row, same field the "Lembur & Potongan" single-employee form
// already writes, just batched across employees for one period at once.
// Cairs together with everyone else's pay the next time "Bayar Gaji" runs
// for that period, not immediately.
export async function setBonusBatch(period: string, rows: { employeeId: string; amount: number }[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");
  if (!rows || rows.length === 0) throw new Error("Tidak ada baris untuk disimpan.");
  if (rows.some((r) => !r.employeeId || r.amount < 0)) throw new Error("Setiap baris wajib punya karyawan dan jumlah tidak boleh negatif.");

  await mapLimit(rows, 8, async (row) => {
    await db.payrollEntry.upsert({
      where: { employeeId_period: { employeeId: row.employeeId, period } },
      update: { allowance: row.amount },
      create: { employeeId: row.employeeId, period, allowance: row.amount },
    });
  });

  await logAudit({
    data: {
      userId: session.user.id,
      action: "payrollEntry.bonusBatch",
      entity: "Employee",
      detail: JSON.stringify({ period, count: rows.length, total: rows.reduce((s, r) => s + r.amount, 0) }),
    },
  });

  revalidatePath("/penggajian");
  revalidatePath("/print/slip");
}

type LatenessBracketRow = { minMinutes: number; maxMinutes: number | null; amount: number };

// Replaces the whole bracket table for one scope target at once (delete +
// recreate), same "whole list is the unit of change" pattern as MBP items —
// simpler than diffing individual row edits, and this table is short by
// nature (a handful of minute ranges).
export async function saveLatenessBrackets(
  scope: "global" | "site" | "position" | "employee",
  refId: string | null,
  rows: LatenessBracketRow[],
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (scope !== "global" && !refId) throw new Error("Target cakupan wajib dipilih.");
  if (rows.some((r) => r.minMinutes < 0 || r.amount < 0 || (r.maxMinutes !== null && r.maxMinutes < r.minMinutes))) {
    throw new Error("Rentang menit atau nominal tidak valid.");
  }

  const where = {
    scope,
    siteId: scope === "site" ? refId : null,
    positionId: scope === "position" ? refId : null,
    employeeId: scope === "employee" ? refId : null,
  };

  await db.$transaction([
    db.latenessBracket.deleteMany({ where }),
    ...(rows.length > 0
      ? [db.latenessBracket.createMany({ data: rows.map((r) => ({ ...where, minMinutes: r.minMinutes, maxMinutes: r.maxMinutes, amount: r.amount })) })]
      : []),
  ]);

  await logAudit({
    data: { userId: session.user.id, action: "latenessBracket.save", entity: "LatenessBracket", detail: JSON.stringify({ scope, refId, rows: rows.length }) },
  });

  revalidatePath("/penggajian");
}

export async function deleteLatenessBrackets(scope: "global" | "site" | "position" | "employee", refId: string | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.latenessBracket.deleteMany({
    where: {
      scope,
      siteId: scope === "site" ? refId : null,
      positionId: scope === "position" ? refId : null,
      employeeId: scope === "employee" ? refId : null,
    },
  });

  await logAudit({
    data: { userId: session.user.id, action: "latenessBracket.delete", entity: "LatenessBracket", detail: JSON.stringify({ scope, refId }) },
  });

  revalidatePath("/penggajian");
}
