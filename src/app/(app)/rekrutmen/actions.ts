"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addCandidate(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "");
  if (!name) throw new Error("Nama wajib diisi.");

  await db.candidate.create({ data: { name, position, appliedDate: new Date(), status: "lamaran" } });
  revalidatePath("/rekrutmen");
}

export async function advanceCandidate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const c = await db.candidate.findUnique({ where: { id } });
  if (!c) return;

  if (c.status === "lamaran") {
    await db.candidate.update({ where: { id }, data: { status: "interview" } });
  } else if (c.status === "interview") {
    await db.candidate.update({ where: { id }, data: { status: "diterima" } });
  } else if (c.status === "diterima") {
    // Activate: convert candidate into a real employee.
    const site = await db.site.findFirst();
    const position = await db.position.findFirst({ where: { name: c.position } });
    if (!site || !position) throw new Error("Tempat kerja atau posisi default belum ada.");

    const empCount = await db.employee.count();
    const empCode = "EMP-" + String(empCount + 1).padStart(4, "0");

    await db.$transaction([
      db.employee.create({
        data: {
          empCode,
          name: c.name,
          siteId: site.id,
          positionId: position.id,
          hireDate: new Date(),
          contractType: "PKWT",
          salaryComponents: { create: { name: "Gaji Pokok", amount: position.baseSalary } },
        },
      }),
      db.candidate.update({ where: { id }, data: { status: "aktif" } }),
    ]);

    await db.auditLog.create({
      data: { userId: session.user.id, action: "candidate.activate", entity: "Candidate", entityId: id },
    });
  }

  revalidatePath("/rekrutmen");
  revalidatePath("/karyawan");
}

export async function rejectCandidate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.candidate.update({ where: { id }, data: { status: "ditolak" } });
  revalidatePath("/rekrutmen");
}
