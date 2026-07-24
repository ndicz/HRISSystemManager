"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { parseBpjsXlsx, type BpjsImportRow } from "@/lib/bpjsImport";
import { mapLimit } from "@/lib/concurrency";

export async function addEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "") || null;
  const hireDateRaw = String(formData.get("hireDate") ?? "").trim();
  const hireDate = hireDateRaw ? new Date(hireDateRaw) : new Date();
  const contractType = String(formData.get("contractType") ?? "PKWT");
  const contractEndRaw = String(formData.get("contractEnd") ?? "");

  if (!name || !siteId || !positionId) {
    throw new Error("Nama, tempat kerja, dan posisi wajib diisi.");
  }

  const position = await db.position.findUnique({ where: { id: positionId } });
  if (!position) throw new Error("Posisi tidak ditemukan.");

  const empCodeRaw = String(formData.get("empCode") ?? "").trim();
  let empCode: string;
  if (empCodeRaw) {
    const taken = await db.employee.findUnique({ where: { empCode: empCodeRaw } });
    if (taken) throw new Error("Nomor karyawan \"" + empCodeRaw + "\" sudah digunakan.");
    empCode = empCodeRaw;
  } else {
    // "WSP" + running number + bulan masuk + tahun masuk (2 digit) — the
    // running number is never reused, so once someone resigns and drops off
    // the active list, later hires' numbers naturally look non-sequential.
    const empCount = await db.employee.count();
    const urut = String(empCount + 1).padStart(3, "0");
    const mm = String(hireDate.getMonth() + 1).padStart(2, "0");
    const yy = String(hireDate.getFullYear() % 100).padStart(2, "0");
    empCode = "WSP " + urut + mm + yy;
  }

  const employee = await db.employee.create({
    data: {
      empCode,
      name,
      siteId,
      positionId,
      clientId,
      hireDate,
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

// Hard delete is only for a genuine mistake (added the wrong person, no
// history yet) — once there's attendance, payroll, or allowance history,
// use "resign" instead (above) so that history stays intact. Cascades
// (SalaryComponent/Certificate/LeaveRequest/Assignment/OvertimeDay) are
// harmless to lose for an employee with no activity yet.
export async function deleteEmployee(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const emp = await db.employee.findUnique({
    where: { id },
    include: { user: true, _count: { select: { attendance: true, payrollEntries: true, allowancePayments: true } } },
  });
  if (!emp) return;

  if (emp.user) {
    throw new Error("Karyawan ini punya akun login terhubung — hapus/lepas akunnya dulu di halaman Pengguna sebelum menghapus data karyawan.");
  }
  const { attendance, payrollEntries, allowancePayments } = emp._count;
  if (attendance > 0 || payrollEntries > 0 || allowancePayments > 0) {
    throw new Error("Karyawan ini sudah punya riwayat absensi/gaji — gunakan \"Resign\" untuk menonaktifkan, bukan hapus, supaya riwayatnya tetap tersimpan.");
  }

  await db.employee.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "employee.delete", entity: "Employee", entityId: id, detail: emp.name },
  });

  revalidatePath("/karyawan");
  revalidatePath("/absensi");
  revalidatePath("/penggajian");
}

export async function updateEmployeeDetails(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const contractType = String(formData.get("contractType") ?? "PKWT");
  const contractEndRaw = String(formData.get("contractEnd") ?? "");
  const kasbon = Math.max(0, parseInt(String(formData.get("kasbon") ?? "0"), 10) || 0);
  const kasbonCicilan = Math.max(1, parseInt(String(formData.get("kasbonCicilan") ?? "1"), 10) || 1);
  const cutiKuota = Math.max(0, parseInt(String(formData.get("cutiKuota") ?? "0"), 10) || 0);
  // Blank = use the standard BPJS formula; a number = deduct this exact
  // amount instead (for cases the formula doesn't match reality).
  const bpjsKesehatanRaw = String(formData.get("bpjsKesehatanOverride") ?? "").trim();
  const bpjsKetenagakerjaanRaw = String(formData.get("bpjsKetenagakerjaanOverride") ?? "").trim();
  const bpjsKesehatanOverride = bpjsKesehatanRaw ? Math.max(0, parseInt(bpjsKesehatanRaw, 10) || 0) : null;
  const bpjsKetenagakerjaanOverride = bpjsKetenagakerjaanRaw ? Math.max(0, parseInt(bpjsKetenagakerjaanRaw, 10) || 0) : null;
  if (!employeeId) throw new Error("Karyawan tidak ditemukan.");

  const existing = await db.employee.findUnique({ where: { id: employeeId }, include: { site: true } });
  if (!existing) throw new Error("Karyawan tidak ditemukan.");

  let transferLog: string | null = null;
  if (siteId && siteId !== existing.siteId) {
    const newSite = await db.site.findUnique({ where: { id: siteId } });
    if (!newSite) throw new Error("Tempat kerja tidak ditemukan.");
    transferLog = JSON.stringify({ from: existing.site.name, to: newSite.name });
  }

  await db.employee.update({
    where: { id: employeeId },
    data: {
      ...(siteId ? { siteId } : {}),
      contractType,
      contractEnd: contractType === "PKWT" && contractEndRaw ? new Date(contractEndRaw) : null,
      kasbon,
      kasbonCicilan,
      cutiKuota,
      bpjsKesehatanOverride,
      bpjsKetenagakerjaanOverride,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "employee.update", entity: "Employee", entityId: employeeId },
  });
  if (transferLog) {
    await db.auditLog.create({
      data: { userId: session.user.id, action: "employee.transfer", entity: "Employee", entityId: employeeId, detail: transferLog },
    });
  }

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
  const amount = parseInt(String(formData.get("amount") ?? "0"), 10) || 0;
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

export async function updateSalaryComponent(componentId: string, name: string, amount: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Nama komponen wajib diisi.");

  const comp = await db.salaryComponent.findUnique({ where: { id: componentId } });
  if (!comp) throw new Error("Komponen tidak ditemukan.");

  await db.salaryComponent.update({ where: { id: componentId }, data: { name: trimmedName, amount } });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "salary.componentUpdate",
      entity: "Employee",
      entityId: comp.employeeId,
      detail: JSON.stringify({ before: { name: comp.name, amount: comp.amount }, after: { name: trimmedName, amount } }),
    },
  });

  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  revalidatePath("/absensi");
  return db.salaryComponent.findMany({ where: { employeeId: comp.employeeId }, orderBy: { id: "asc" } });
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

export async function updateEmployeeProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) throw new Error("Karyawan tidak ditemukan.");

  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const dateOrNull = (k: string) => {
    const v = str(k);
    return v ? new Date(v) : null;
  };

  await db.employee.update({
    where: { id: employeeId },
    data: {
      ktpNumber: str("ktpNumber"),
      phone: str("phone"),
      contractNumber: str("contractNumber"),
      education: str("education"),
      bankName: str("bankName"),
      bankAccount: str("bankAccount"),
      birthPlace: str("birthPlace"),
      birthDate: dateOrNull("birthDate"),
      address: str("address"),
      gender: str("gender"),
      religion: str("religion"),
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "employee.updateProfile", entity: "Employee", entityId: employeeId },
  });

  revalidatePath("/karyawan");
}

export async function addCertificate(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const validFromRaw = String(formData.get("validFrom") ?? "").trim();
  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
  if (!employeeId || !name) throw new Error("Nama sertifikat wajib diisi.");

  await db.certificate.create({
    data: {
      employeeId,
      name,
      validFrom: validFromRaw ? new Date(validFromRaw) : null,
      validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "certificate.add", entity: "Employee", entityId: employeeId, detail: JSON.stringify({ name }) },
  });

  revalidatePath("/karyawan");
  return db.certificate.findMany({ where: { employeeId }, orderBy: { id: "asc" } });
}

export async function removeCertificate(certificateId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const cert = await db.certificate.findUnique({ where: { id: certificateId } });
  if (!cert) throw new Error("Sertifikat tidak ditemukan.");

  await db.certificate.delete({ where: { id: certificateId } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "certificate.remove", entity: "Employee", entityId: cert.employeeId, detail: cert.name },
  });

  revalidatePath("/karyawan");
  return db.certificate.findMany({ where: { employeeId: cert.employeeId }, orderBy: { id: "asc" } });
}

export async function fetchCertificates(employeeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return db.certificate.findMany({ where: { employeeId }, orderBy: { id: "asc" } });
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

export async function updateSite(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const supervisor = String(formData.get("supervisor") ?? "").trim();
  const umr = Math.max(0, parseInt(String(formData.get("umr") ?? "0"), 10) || 0);
  if (!name) throw new Error("Nama tempat kerja wajib diisi.");

  await db.site.update({ where: { id }, data: { name, address: address || "-", supervisor: supervisor || "-", umr } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "site.update", entity: "Site", entityId: id },
  });

  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  revalidatePath("/absensi");
}

// Blocked while any employee is still placed at this site — reassign them
// first (PayrollRate rows referencing this site are safe: onDelete:SetNull
// just drops back to "no rate configured" for that period/site).
export async function deleteSite(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const site = await db.site.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!site) return;
  if (site._count.employees > 0) {
    throw new Error(`Tempat kerja tidak bisa dihapus — masih ada ${site._count.employees} karyawan yang ditempatkan di sini. Pindahkan dulu sebelum menghapus.`);
  }

  await db.site.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "site.delete", entity: "Site", entityId: id, detail: site.name },
  });

  revalidatePath("/karyawan");
}

export async function addPosition(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const salaryType = String(formData.get("salaryType") ?? "bulanan");
  const baseSalary = Math.max(0, parseInt(String(formData.get("baseSalary") ?? "0"), 10) || 0);

  if (!name) throw new Error("Nama posisi wajib diisi.");

  const existing = await db.position.findUnique({ where: { name } });
  if (existing) throw new Error("Posisi dengan nama ini sudah ada.");

  const position = await db.position.create({
    data: { name, salaryType, baseSalary },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "position.create", entity: "Position", entityId: position.id, detail: JSON.stringify({ name }) },
  });

  revalidatePath("/karyawan");
  revalidatePath("/rekrutmen");
  revalidatePath("/absensi");
}

export async function updatePosition(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const positionId = String(formData.get("positionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const salaryType = String(formData.get("salaryType") ?? "bulanan");
  const baseSalary = Math.max(0, parseInt(String(formData.get("baseSalary") ?? "0"), 10) || 0);
  if (!positionId || !name) throw new Error("Nama posisi wajib diisi.");

  const conflict = await db.position.findUnique({ where: { name } });
  if (conflict && conflict.id !== positionId) throw new Error("Posisi dengan nama ini sudah ada.");

  await db.position.update({ where: { id: positionId }, data: { name, salaryType, baseSalary } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "position.update", entity: "Position", entityId: positionId, detail: JSON.stringify({ name, salaryType, baseSalary }) },
  });

  revalidatePath("/karyawan");
  revalidatePath("/rekrutmen");
  revalidatePath("/absensi");
  revalidatePath("/penggajian");
}

// Blocked while any employee still holds this position — reassign them
// first (mirrors deleteSite's guard).
export async function deletePosition(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const position = await db.position.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!position) return;
  if (position._count.employees > 0) {
    throw new Error(`Posisi tidak bisa dihapus — masih ada ${position._count.employees} karyawan dengan posisi ini. Ubah posisi mereka dulu sebelum menghapus.`);
  }

  await db.position.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "position.delete", entity: "Position", entityId: id, detail: position.name },
  });

  revalidatePath("/karyawan");
  revalidatePath("/rekrutmen");
  revalidatePath("/absensi");
}

export async function addAssignment(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const employeeId = String(formData.get("employeeId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const mandays = Math.max(0, parseInt(String(formData.get("mandays") ?? "0"), 10) || 0);
  const cost = Math.max(0, parseInt(String(formData.get("cost") ?? "0"), 10) || 0);
  const periodRaw = String(formData.get("period") ?? "").trim();
  const period = /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : null;
  if (!employeeId || !title) throw new Error("Karyawan dan judul penugasan wajib diisi.");

  const assignment = await db.assignment.create({ data: { employeeId, title, mandays, cost, period } });

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
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
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

// Only while "berjalan" — once "selesai" it's already posted a Transaction
// to Kas (above), so editing the cost or deleting it afterward would
// silently desync from what was actually recorded as paid. Same guard
// rail as invoices/payables elsewhere in this app.
export async function updateAssignment(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await db.assignment.findUnique({ where: { id } });
  if (!existing) throw new Error("Penugasan tidak ditemukan.");
  if (existing.status === "selesai") throw new Error("Penugasan yang sudah selesai tidak bisa diedit — biayanya sudah tercatat di Kas.");

  const title = String(formData.get("title") ?? "").trim();
  const mandays = Math.max(0, parseInt(String(formData.get("mandays") ?? "0"), 10) || 0);
  const cost = Math.max(0, parseInt(String(formData.get("cost") ?? "0"), 10) || 0);
  const periodRaw = String(formData.get("period") ?? "").trim();
  const period = /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : null;
  if (!title) throw new Error("Judul penugasan wajib diisi.");

  await db.assignment.update({ where: { id }, data: { title, mandays, cost, period } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "assignment.update", entity: "Assignment", entityId: id, detail: JSON.stringify({ title }) },
  });

  revalidatePath("/karyawan");
}

export async function deleteAssignment(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const assignment = await db.assignment.findUnique({ where: { id } });
  if (!assignment) return;
  if (assignment.status === "selesai") throw new Error("Penugasan yang sudah selesai tidak bisa dihapus — biayanya sudah tercatat di Kas.");

  await db.assignment.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "assignment.delete", entity: "Assignment", entityId: id, detail: assignment.title },
  });

  revalidatePath("/karyawan");
}

// ── BPJS bulk import ──────────────────────────────────────────────────

export async function parseBpjsImport(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File tidak ditemukan.");

  const buf = Buffer.from(await file.arrayBuffer());
  return parseBpjsXlsx(buf);
}

export async function applyBpjsImport(rows: BpjsImportRow[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!rows || rows.length === 0) throw new Error("Tidak ada data untuk diterapkan.");

  // Normalize away whitespace differences before matching — the source
  // spreadsheet isn't always consistent about the space in "WSP 1930725"
  // vs "WSP1930725" for the same employee, so an exact-string match would
  // silently miss real matches over a formatting slip, not a real mismatch.
  const normalize = (s: string) => s.replace(/\s+/g, "").toUpperCase();

  // Two genuinely different employees can normalize to the same key (e.g.
  // "WSP 0160620" vs "WSP0160620" both being real, distinct, currently-
  // assigned codes for two different people rather than the same person
  // written two ways) — silently picking one via last-write-wins would
  // misattribute BPJS figures to the wrong person. Detect that and treat
  // those codes as unmatched/ambiguous instead of guessing.
  const employees = await db.employee.findMany({ where: { empCode: { not: "" } }, select: { id: true, empCode: true } });
  const groupedByNorm = new Map<string, typeof employees>();
  for (const e of employees) {
    const key = normalize(e.empCode);
    (groupedByNorm.get(key) ?? groupedByNorm.set(key, []).get(key)!).push(e);
  }
  const byCode = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const [key, group] of groupedByNorm) {
    if (group.length === 1) byCode.set(key, group[0].id);
    else ambiguous.add(key);
  }

  const matched: string[] = [];
  const unmatched: string[] = [];

  await mapLimit(rows, 10, async (row) => {
    const norm = normalize(row.empCode);
    if (ambiguous.has(norm)) {
      unmatched.push(row.empCode + " (kode ambigu — cocok dengan >1 karyawan, lewati)");
      return;
    }
    const employeeId = byCode.get(norm);
    if (!employeeId) {
      unmatched.push(row.empCode);
      return;
    }
    await db.employee.update({
      where: { id: employeeId },
      data: {
        // null (blank cell in the source) leaves the existing value alone
        // instead of overwriting it — Prisma skips undefined fields, and
        // BpjsImportRow already encodes "blank" as null vs. an explicit 0.
        ...(row.bpjsKesehatan !== null ? { bpjsKesehatanOverride: row.bpjsKesehatan } : {}),
        ...(row.bpjsKetenagakerjaan !== null ? { bpjsKetenagakerjaanOverride: row.bpjsKetenagakerjaan } : {}),
      },
    });
    matched.push(row.empCode);
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "employee.bpjsImport",
      entity: "Employee",
      detail: JSON.stringify({ matched: matched.length, unmatched: unmatched.length }),
    },
  });

  revalidatePath("/karyawan");
  revalidatePath("/penggajian");
  return { matched: matched.length, unmatched };
}
