"use server";

import { UserError } from "@/lib/userError";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { nextEmpCode, isUniqueViolation } from "@/lib/empCode";

export async function addCandidate(formData: FormData) {
  await requireAccess("/rekrutmen");

  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "");
  if (!name) throw new UserError("Nama wajib diisi.");

  await db.candidate.create({ data: { name, position, appliedDate: new Date(), status: "lamaran" } });
  revalidatePath("/rekrutmen");
}

export async function advanceCandidate(id: string, siteId?: string) {
  const session = await requireAccess("/rekrutmen");

  const c = await db.candidate.findUnique({ where: { id } });
  if (!c) return;

  if (c.status === "lamaran") {
    await db.candidate.update({ where: { id }, data: { status: "interview" } });
  } else if (c.status === "interview") {
    await db.candidate.update({ where: { id }, data: { status: "diterima" } });
  } else if (c.status === "diterima") {
    // Activate: convert candidate into a real employee, at the tempat kerja
    // HR picked (it used to silently take whichever site came first).
    if (!siteId) throw new UserError("Pilih tempat kerja untuk karyawan baru ini dulu.");
    const site = await db.site.findUnique({ where: { id: siteId } });
    if (!site) throw new UserError("Tempat kerja tidak ditemukan.");
    const position = await db.position.findFirst({ where: { name: c.position } });
    if (!position) throw new UserError(`Posisi "${c.position}" belum ada di Karyawan & Lokasi — tambahkan dulu.`);

    const hireDate = new Date();
    for (let attempt = 0; ; attempt++) {
      // Same numbering as Tambah Karyawan.
      const empCode = await nextEmpCode(hireDate);
      try {
        await db.$transaction([
          db.employee.create({
            data: {
              empCode,
              name: c.name,
              siteId: site.id,
              positionId: position.id,
              hireDate,
              contractType: "PKWT",
              salaryComponents: { create: { name: "Gaji Pokok", amount: position.baseSalary } },
            },
          }),
          db.candidate.update({ where: { id }, data: { status: "aktif" } }),
        ]);
        break;
      } catch (err) {
        if (!isUniqueViolation(err) || attempt >= 4) throw err;
      }
    }

    await db.auditLog.create({
      data: { userId: session.user.id, action: "candidate.activate", entity: "Candidate", entityId: id },
    });
  }

  revalidatePath("/rekrutmen");
  revalidatePath("/karyawan");
}

export async function rejectCandidate(id: string) {
  await requireAccess("/rekrutmen");

  await db.candidate.update({ where: { id }, data: { status: "ditolak" } });
  revalidatePath("/rekrutmen");
}

export async function updateCandidate(id: string, formData: FormData) {
  const session = await requireAccess("/rekrutmen");

  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "");
  if (!name) throw new UserError("Nama wajib diisi.");

  await db.candidate.update({ where: { id }, data: { name, position } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "candidate.update", entity: "Candidate", entityId: id },
  });

  revalidatePath("/rekrutmen");
}

// Nothing references Candidate.id via foreign key (activation copies the
// data into a brand-new Employee row rather than linking back), so this is
// a plain, unguarded delete.
export async function deleteCandidate(id: string) {
  const session = await requireAccess("/rekrutmen");

  const c = await db.candidate.findUnique({ where: { id } });
  if (!c) return;

  await db.candidate.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "candidate.delete", entity: "Candidate", entityId: id, detail: c.name },
  });

  revalidatePath("/rekrutmen");
}
