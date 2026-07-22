"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Prisma, type PrismaClient } from "@prisma/client";
import { parseAttendanceXlsx, type AttendanceImportRow, type AttendanceImportDay } from "@/lib/attendanceImport";
import { computePayroll } from "@/lib/payroll";
import { mapLimit } from "@/lib/concurrency";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Recomputes an employee's attendance aggregate (presentDays, leaveDays,
// workDays used by computePayroll's absence deduction) from its
// AttendanceRecord rows. Scoped to whichever calendar month actually holds
// most of that employee's records — NOT the month of whatever date was
// just edited. A single stray correction dated outside the imported period
// (e.g. the "tambah/koreksi" form defaulting to today) must not collapse
// the aggregate down to "1/1"; the substantive imported month should stay
// authoritative until it, in turn, has fewer records than some other month.
async function recomputeEmployeeAttendance(tx: Tx, employeeId: string) {
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
  const izin = bestRecords.filter((r) => r.status === "Izin").length;
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

// Resolves the employee code to use from the Excel row's own code column,
// checked against an in-memory set of codes already in use (across *all*
// employees, any status) instead of a per-row DB round-trip — with ~95
// employees that was ~95 extra network round-trips to Neon on its own.
// Falls back to null if blank or already used by a *different* employee.
function resolveEmpCode(usedCodes: Set<string>, codeFromExcel: string, currentCode?: string): string | null {
  const trimmed = codeFromExcel.trim();
  if (!trimmed) return null;
  if (trimmed === currentCode) return null;
  if (usedCodes.has(trimmed)) return null;
  return trimmed;
}

// Bulk-writes attendance days as a handful of multi-row INSERT ... ON
// CONFLICT statements instead of one upsert per day. With ~95 employees ×
// ~30 days that's ~2,850 individual round trips to Neon — the dominant
// cost of an import even after employees themselves were parallelized.
// Batching them into ~500-row chunks turns that into a handful of round
// trips instead. `id` has no DB-level default (Prisma generates cuids
// client-side), so a fresh id is generated per row here.
async function bulkUpsertAttendanceDays(entries: { employeeId: string; day: AttendanceImportDay }[]): Promise<void> {
  const CHUNK = 500;
  const chunks: (typeof entries)[] = [];
  for (let i = 0; i < entries.length; i += CHUNK) chunks.push(entries.slice(i, i + CHUNK));

  await mapLimit(chunks, 4, async (chunk) => {
    const values = chunk.map(
      ({ employeeId, day }) => Prisma.sql`(
        ${randomUUID()}, ${employeeId}, ${day.date}, ${day.status},
        ${day.checkIn ?? null}, ${day.checkOut ?? null}, ${day.location ?? null},
        ${day.scheduledCheckIn ?? null}, ${day.scheduledCheckOut ?? null}, ${day.lateMin}
      )`,
    );
    await db.$executeRaw`
      INSERT INTO "AttendanceRecord"
        ("id", "employeeId", "date", "status", "checkIn", "checkOut", "location", "scheduledCheckIn", "scheduledCheckOut", "lateMin")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("employeeId", "date") DO UPDATE SET
        "status" = EXCLUDED."status",
        "checkIn" = EXCLUDED."checkIn",
        "checkOut" = EXCLUDED."checkOut",
        "location" = EXCLUDED."location",
        "scheduledCheckIn" = EXCLUDED."scheduledCheckIn",
        "scheduledCheckOut" = EXCLUDED."scheduledCheckOut",
        "lateMin" = EXCLUDED."lateMin"
    `;
  });
}

export async function parseAttendanceImport(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File tidak ditemukan.");

  const buf = Buffer.from(await file.arrayBuffer());
  return parseAttendanceXlsx(buf);
}

export async function applyAttendanceImport(rows: AttendanceImportRow[], siteId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!siteId) throw new Error("Tempat kerja tujuan wajib dipilih.");
  if (!rows || rows.length === 0) throw new Error("Tidak ada data untuk diterapkan.");

  const [employees, allCodeRows] = await Promise.all([
    db.employee.findMany({ where: { status: "aktif" } }),
    db.employee.findMany({ select: { empCode: true } }),
  ]);
  const position = (await db.position.findFirst({ where: { name: "Staff Admin" } })) ?? (await db.position.findFirst());
  if (!position) throw new Error("Belum ada data posisi — tambahkan posisi terlebih dahulu.");

  const empByName = new Map(employees.map((e) => [e.name.toLowerCase(), e]));
  const empByCode = new Map(employees.filter((e) => e.empCode.trim()).map((e) => [e.empCode.trim(), e]));
  const usedCodes = new Set(allCodeRows.map((e) => e.empCode));
  let empCount = allCodeRows.length;
  let created = 0;
  let updated = 0;
  let daysRecorded = 0;

  // Resolve every row's target employee + empCode up front, synchronously
  // and with no DB calls — this is what lets the actual writes below run
  // concurrently instead of one row waiting on the previous row's code
  // uniqueness check to come back from Neon.
  //
  // Match by empCode first, falling back to name only when the row has no
  // code or it doesn't resolve to a known employee. Names alone are prone
  // to spelling drift between the attendance export and the HR roster
  // (e.g. "Andy" vs "Andi") and a mismatch there used to silently create a
  // duplicate employee with a freshly generated code instead of reusing
  // the existing, correctly-numbered one — the code is the authoritative
  // identifier and should win whenever it's present and known.
  const plans = rows.map((r) => {
    const trimmedCode = r.code.trim();
    const existing = (trimmedCode && empByCode.get(trimmedCode)) || empByName.get(r.name.toLowerCase());
    if (existing) {
      const resolvedCode = resolveEmpCode(usedCodes, r.code, existing.empCode);
      if (resolvedCode) usedCodes.add(resolvedCode);
      return { row: r, existing, empCode: resolvedCode };
    }
    let empCode = resolveEmpCode(usedCodes, r.code);
    if (!empCode) {
      empCount += 1;
      empCode = "EMP-" + String(empCount).padStart(4, "0");
    }
    usedCodes.add(empCode);
    return { row: r, existing: undefined as typeof existing, empCode };
  });

  // Deliberately NOT wrapped in a single db.$transaction: a real import can
  // easily mean 95 employees × 30 attendance days ≈ 2,850 upserts, which
  // blows straight through Prisma's 5s interactive transaction timeout
  // long before finishing. Each employee upsert and each day upsert is
  // independently idempotent, so running them outside a transaction is
  // safe — if this fails partway (network hiccup, etc.), re-running the
  // same import just re-applies already-written rows instead of
  // duplicating or corrupting anything.
  //
  // Employees are processed with bounded concurrency (mapLimit) rather
  // than strictly one at a time — previously every employee waited on the
  // full round-trip of the one before it, which serialized ~95 employees
  // end-to-end even though each employee's own day-records were already
  // parallel. That was the actual bottleneck, not the transaction timeout.
  const allDayEntries: { employeeId: string; day: AttendanceImportDay }[] = [];
  await mapLimit(plans, 10, async ({ row: r, existing, empCode }) => {
    const workDays = r.hadir + r.sakit + r.alpha;
    const latestDay = r.days.reduce<(typeof r.days)[number] | null>(
      (latest, d) => (!latest || d.date > latest.date ? d : latest),
      null,
    );
    const latestStatus =
      latestDay?.status ?? (r.hadir >= r.sakit && r.hadir >= r.alpha ? "Hadir" : r.sakit >= r.alpha ? "Izin" : "Alpha");

    let employeeId: string;

    if (existing) {
      await db.employee.update({
        where: { id: existing.id },
        data: {
          ...(empCode ? { empCode } : {}),
          attStatus: latestStatus,
          checkIn: latestDay?.checkIn ?? (latestStatus === "Hadir" ? "07:00" : "-"),
          checkOut: latestDay?.checkOut ?? (latestStatus === "Hadir" ? "16:00" : "-"),
          presentDays: r.hadir,
          leaveDays: r.sakit,
          workDays: workDays || existing.workDays,
        },
      });
      employeeId = existing.id;
      updated++;
    } else {
      const emp = await db.employee.create({
        data: {
          empCode: empCode!,
          name: r.name,
          siteId,
          positionId: position.id,
          hireDate: new Date(),
          contractType: "PKWT",
          attStatus: latestStatus,
          checkIn: latestDay?.checkIn ?? (latestStatus === "Hadir" ? "07:00" : "-"),
          checkOut: latestDay?.checkOut ?? (latestStatus === "Hadir" ? "16:00" : "-"),
          presentDays: r.hadir,
          leaveDays: r.sakit,
          workDays: workDays || 22,
          salaryComponents: { create: { name: "Gaji Pokok", amount: position.baseSalary } },
        },
      });
      employeeId = emp.id;
      created++;
    }

    for (const day of r.days) allDayEntries.push({ employeeId, day });
    daysRecorded += r.days.length;
  });

  // All employees are resolved by this point, so every day-record's
  // employeeId is known — write them all in a handful of bulk statements
  // instead of one upsert per day (see bulkUpsertAttendanceDays above).
  await bulkUpsertAttendanceDays(allDayEntries);

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "attendance.import",
      entity: "Employee",
      detail: JSON.stringify({ created, updated, daysRecorded }),
    },
  });

  revalidatePath("/absensi");
  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  return { created, updated, daysRecorded };
}

async function attendanceRecap(employeeId: string) {
  const [records, employee] = await Promise.all([
    db.attendanceRecord.findMany({ where: { employeeId }, orderBy: { date: "asc" } }),
    db.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { salaryComponents: true } }),
  ]);

  const payroll = computePayroll(employee, employee.salaryComponents);

  return {
    records,
    payroll: {
      gajiPokok: payroll.gajiPokok,
      potonganAbsensi: payroll.potonganAbsensi,
      presentDays: employee.presentDays,
      leaveDays: employee.leaveDays,
      workDays: employee.workDays,
    },
  };
}

export async function fetchAttendanceRecap(employeeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return attendanceRecap(employeeId);
}

// Correction entry point: editing a single day from the per-employee recap
// dialog. Recomputes that month's aggregate (which feeds computePayroll's
// absence-based deduction) after the write.
export async function upsertAttendanceDay(employeeId: string, dateIso: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!["Hadir", "Izin", "Alpha", "Hari Libur"].includes(status)) throw new Error("Status tidak valid.");

  const date = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal tidak valid.");

  await db.$transaction(async (tx) => {
    await tx.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { status },
      create: { employeeId, date, status },
    });
    await recomputeEmployeeAttendance(tx as unknown as Tx, employeeId);
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "attendance.correct",
      entity: "Employee",
      entityId: employeeId,
      detail: JSON.stringify({ date: dateIso, status }),
    },
  });

  revalidatePath("/absensi");
  revalidatePath("/penggajian");
  return attendanceRecap(employeeId);
}
