"use server";

import { UserError } from "@/lib/userError";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { syncLeaveAttendance } from "@/lib/leaveAttendance";
import type { Tx } from "@/lib/attendanceAggregate";

function revalidateLeave() {
  revalidatePath("/cuti");
  revalidatePath("/absensi");
  revalidatePath("/penggajian");
  revalidatePath("/laporan");
}

export async function addLeaveRequest(formData: FormData) {
  await requireAccess("/cuti");

  const employeeId = String(formData.get("employeeId") ?? "");
  const type = String(formData.get("type") ?? "Cuti Tahunan");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "-";

  if (!employeeId || !startDate || !endDate) throw new UserError("Karyawan dan tanggal wajib diisi.");
  if (new Date(endDate) < new Date(startDate)) throw new UserError("Tanggal selesai tidak boleh sebelum tanggal mulai.");

  await db.leaveRequest.create({
    data: { employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
  });

  revalidatePath("/cuti");
}

export async function setLeaveStatus(id: string, status: "disetujui" | "ditolak") {
  const session = await requireAccess("/cuti");

  // An approved request fills its days into absensi (as Cuti/Sakit/Izin);
  // rejecting takes back the days it filled in.
  await db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.update({ where: { id }, data: { status } });
    await syncLeaveAttendance(tx as unknown as Tx, leave);
  });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "leave." + status, entity: "LeaveRequest", entityId: id },
  });

  revalidateLeave();
}

// Cuti quota used (cutiTerpakai) is computed live from approved
// LeaveRequest rows, not a separately posted/cached figure — so editing or
// deleting one, even an already-approved one, safely and automatically
// recalculates the quota with no orphaned record left behind.
export async function updateLeaveRequest(id: string, formData: FormData) {
  const session = await requireAccess("/cuti");

  const type = String(formData.get("type") ?? "Cuti Tahunan");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "-";
  if (!startDate || !endDate) throw new UserError("Tanggal wajib diisi.");
  if (new Date(endDate) < new Date(startDate)) throw new UserError("Tanggal selesai tidak boleh sebelum tanggal mulai.");

  await db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.update({
      where: { id },
      data: { type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
    });
    // New dates/type → the absensi days it filled in move with it.
    await syncLeaveAttendance(tx as unknown as Tx, leave);
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "leave.update", entity: "LeaveRequest", entityId: id },
  });

  revalidateLeave();
}

export async function deleteLeaveRequest(id: string) {
  const session = await requireAccess("/cuti");

  await db.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({ where: { id } });
    if (!leave) return;
    // Take back the absensi days it filled in before the request goes.
    await syncLeaveAttendance(tx as unknown as Tx, { ...leave, status: "dihapus" });
    await tx.leaveRequest.delete({ where: { id } });
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "leave.delete", entity: "LeaveRequest", entityId: id },
  });

  revalidateLeave();
}
