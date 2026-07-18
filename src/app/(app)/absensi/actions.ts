"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { Prisma, PrismaClient } from "@prisma/client";
import { parseAttendanceXlsx, type AttendanceImportRow } from "@/lib/attendanceImport";
import { computePayroll } from "@/lib/payroll";

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
// falling back to null if it's blank or already used by a *different*
// employee (so re-importing never collides on the unique empCode index).
async function resolveEmpCode(tx: Tx, codeFromExcel: string, excludeEmployeeId?: string): Promise<string | null> {
  const trimmed = codeFromExcel.trim();
  if (!trimmed) return null;
  const taken = await tx.employee.findUnique({ where: { empCode: trimmed } });
  if (taken && taken.id !== excludeEmployeeId) return null;
  return trimmed;
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

  const employees = await db.employee.findMany({ where: { status: "aktif" } });
  const position = (await db.position.findFirst({ where: { name: "Staff Admin" } })) ?? (await db.position.findFirst());
  if (!position) throw new Error("Belum ada data posisi — tambahkan posisi terlebih dahulu.");

  let empCount = await db.employee.count();
  let created = 0;
  let updated = 0;
  let daysRecorded = 0;

  await db.$transaction(async (tx) => {
    for (const r of rows) {
      const workDays = r.hadir + r.sakit + r.alpha;
      const latestDay = r.days.reduce<(typeof r.days)[number] | null>(
        (latest, d) => (!latest || d.date > latest.date ? d : latest),
        null,
      );
      const latestStatus =
        latestDay?.status ?? (r.hadir >= r.sakit && r.hadir >= r.alpha ? "Hadir" : r.sakit >= r.alpha ? "Izin" : "Alpha");

      const existing = employees.find((e) => e.name.toLowerCase() === r.name.toLowerCase());
      let employeeId: string;

      if (existing) {
        const resolvedCode = await resolveEmpCode(tx as unknown as Tx, r.code, existing.id);
        await tx.employee.update({
          where: { id: existing.id },
          data: {
            ...(resolvedCode && resolvedCode !== existing.empCode ? { empCode: resolvedCode } : {}),
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
        let empCode = await resolveEmpCode(tx as unknown as Tx, r.code);
        if (!empCode) {
          empCount += 1;
          empCode = "EMP-" + String(empCount).padStart(4, "0");
        }

        const emp = await tx.employee.create({
          data: {
            empCode,
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

      for (const day of r.days) {
        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date: day.date } },
          update: { status: day.status, checkIn: day.checkIn ?? null, checkOut: day.checkOut ?? null, location: day.location ?? null },
          create: {
            employeeId,
            date: day.date,
            status: day.status,
            checkIn: day.checkIn ?? null,
            checkOut: day.checkOut ?? null,
            location: day.location ?? null,
          },
        });
        daysRecorded++;
      }
    }
  });

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
