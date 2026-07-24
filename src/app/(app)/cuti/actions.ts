"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addLeaveRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const type = String(formData.get("type") ?? "Cuti Tahunan");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "-";

  if (!employeeId || !startDate || !endDate) throw new Error("Karyawan dan tanggal wajib diisi.");

  await db.leaveRequest.create({
    data: { employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
  });

  revalidatePath("/cuti");
}

export async function setLeaveStatus(id: string, status: "disetujui" | "ditolak") {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.leaveRequest.update({ where: { id }, data: { status } });
  await db.auditLog.create({
    data: { userId: session.user.id, action: "leave." + status, entity: "LeaveRequest", entityId: id },
  });

  revalidatePath("/cuti");
}

// Cuti quota used (cutiTerpakai) is computed live from approved
// LeaveRequest rows, not a separately posted/cached figure — so editing or
// deleting one, even an already-approved one, safely and automatically
// recalculates the quota with no orphaned record left behind.
export async function updateLeaveRequest(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const type = String(formData.get("type") ?? "Cuti Tahunan");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "-";
  if (!startDate || !endDate) throw new Error("Tanggal wajib diisi.");

  await db.leaveRequest.update({
    where: { id },
    data: { type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "leave.update", entity: "LeaveRequest", entityId: id },
  });

  revalidatePath("/cuti");
}

export async function deleteLeaveRequest(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.leaveRequest.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "leave.delete", entity: "LeaveRequest", entityId: id },
  });

  revalidatePath("/cuti");
}
