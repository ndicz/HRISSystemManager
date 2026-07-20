"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "") || null;
  const contractType = String(formData.get("contractType") ?? "PKWT");
  const contractEndRaw = String(formData.get("contractEnd") ?? "");

  if (!name || !siteId || !positionId) {
    throw new Error("Nama, tempat kerja, dan posisi wajib diisi.");
  }

  const position = await db.position.findUnique({ where: { id: positionId } });
  if (!position) throw new Error("Posisi tidak ditemukan.");

  const empCount = await db.employee.count();
  const empCode = "EMP-" + String(empCount + 1).padStart(4, "0");

  const employee = await db.employee.create({
    data: {
      empCode,
      name,
      siteId,
      positionId,
      clientId,
      hireDate: new Date(),
      contractType,
      contractEnd: contractType === "PKWT" && contractEndRaw ? new Date(contractEndRaw) : null,
      salaryComponents: { create: { name: "Gaji Pokok", amount: position.baseSalary } },
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "employee.create",
      entity: "Employee",
      entityId: employee.id,
      detail: JSON.stringify({ name, empCode }),
    },
  });

  revalidatePath("/karyawan");
}

export async function resignEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const resignDateRaw = String(formData.get("resignDate") ?? "");
  const resignReason = String(formData.get("resignReason") ?? "").trim();
  if (!employeeId || !resignDateRaw) throw new Error("Tanggal resign wajib diisi.");

  await db.employee.update({
    where: { id: employeeId },
    data: { status: "resign", resignDate: new Date(resignDateRaw), resignReason: resignReason || "-" },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "employee.resign",
      entity: "Employee",
      entityId: employeeId,
      detail: JSON.stringify({ resignDate: resignDateRaw, resignReason }),
    },
  });

  revalidatePath("/karyawan");
  revalidatePath("/absensi");
  revalidatePath("/penggajian");
}

export async function updateEmployeeDetails(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const contractType = String(formData.get("contractType") ?? "PKWT");
  const contractEndRaw = String(formData.get("contractEnd") ?? "");
  const kasbon = Math.max(0, parseInt(String(formData.get("kasbon") ?? "0"), 10) || 0);
  const cutiKuota = Math.max(0, parseInt(String(formData.get("cutiKuota") ?? "0"), 10) || 0);
  if (!employeeId) throw new Error("Karyawan tidak ditemukan.");

  await db.employee.update({
    where: { id: employeeId },
    data: {
      contractType,
      contractEnd: contractType === "PKWT" && contractEndRaw ? new Date(contractEndRaw) : null,
      kasbon,
      cutiKuota,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "employee.update", entity: "Employee", entityId: employeeId },
  });

  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  revalidatePath("/cuti");
  revalidatePath("/absensi");
}

export async function addSalaryComponent(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Math.max(0, parseInt(String(formData.get("amount") ?? "0"), 10) || 0);
  if (!employeeId || !name) throw new Error("Nama komponen wajib diisi.");

  await db.salaryComponent.create({ data: { employeeId, name, amount } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "salary.componentAdd",
      entity: "Employee",
      entityId: employeeId,
      detail: JSON.stringify({ name, amount }),
    },
  });

  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  revalidatePath("/absensi");
  return db.salaryComponent.findMany({ where: { employeeId }, orderBy: { id: "asc" } });
}

export async function removeSalaryComponent(componentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const comp = await db.salaryComponent.findUnique({ where: { id: componentId } });
  if (!comp) throw new Error("Komponen tidak ditemukan.");

  const count = await db.salaryComponent.count({ where: { employeeId: comp.employeeId } });
  if (count <= 1) throw new Error("Minimal harus ada 1 komponen gaji.");

  await db.salaryComponent.delete({ where: { id: componentId } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "salary.componentRemove", entity: "Employee", entityId: comp.employeeId, detail: comp.name },
  });

  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  revalidatePath("/absensi");
  return db.salaryComponent.findMany({ where: { employeeId: comp.employeeId }, orderBy: { id: "asc" } });
}

export async function fetchSalaryComponents(employeeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return db.salaryComponent.findMany({ where: { employeeId }, orderBy: { id: "asc" } });
}

export async function addSite(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const supervisor = String(formData.get("supervisor") ?? "").trim();
  const umr = Math.max(0, parseInt(String(formData.get("umr") ?? "0"), 10) || 0);

  if (!name) throw new Error("Nama tempat kerja wajib diisi.");

  const site = await db.site.create({
    data: { name, address: address || "-", supervisor: supervisor || "-", umr },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "site.create", entity: "Site", entityId: site.id, detail: JSON.stringify({ name }) },
  });

  revalidatePath("/karyawan");
}

export async function addAssignment(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const mandays = Math.max(0, parseInt(String(formData.get("mandays") ?? "0"), 10) || 0);
  const cost = Math.max(0, parseInt(String(formData.get("cost") ?? "0"), 10) || 0);
  if (!employeeId || !title) throw new Error("Karyawan dan judul penugasan wajib diisi.");

  const assignment = await db.assignment.create({ data: { employeeId, title, mandays, cost } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "assignment.create", entity: "Assignment", entityId: assignment.id, detail: JSON.stringify({ title }) },
  });

  revalidatePath("/karyawan");
}

export async function completeAssignment(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const assignment = await db.assignment.findUnique({ where: { id }, include: { employee: true } });
  if (!assignment || assignment.status === "selesai") return;

  const account = await db.account.findFirst({ where: { code: "5007" } });
  const cashAccount = await db.cashAccount.findFirst();
  if (account && cashAccount) {
    await db.transaction.create({
      data: {
        date: new Date(),
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Biaya Penugasan Tambahan — " + assignment.title + " (" + assignment.employee.name + ")",
        amount: assignment.cost,
        type: "keluar",
      },
    });
  }

  await db.assignment.update({ where: { id }, data: { status: "selesai" } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "assignment.complete", entity: "Assignment", entityId: id },
  });

  revalidatePath("/karyawan");
  revalidatePath("/kas");
}
