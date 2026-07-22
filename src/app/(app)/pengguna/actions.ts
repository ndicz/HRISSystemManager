"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ASSIGNABLE_NAV_ITEMS, type Role } from "@/lib/rbac";

const ROLES: Role[] = ["ADMIN", "HR", "FINANCE", "SUPERVISOR", "EMPLOYEE"];
const ASSIGNABLE_HREFS = new Set(ASSIGNABLE_NAV_ITEMS.map((i) => i.href));

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Hanya admin yang bisa mengelola pengguna.");
  return session;
}

function parsePageAccess(formData: FormData): string[] {
  if (formData.get("customAccess") !== "on") return [];
  return formData
    .getAll("pageAccess")
    .map((v) => String(v))
    .filter((href) => ASSIGNABLE_HREFS.has(href));
}

export async function createUser(formData: FormData) {
  const session = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "") || null;
  const pageAccess = parsePageAccess(formData);

  if (!name || !email || !password) throw new Error("Nama, email, dan password wajib diisi.");
  if (password.length < 6) throw new Error("Password minimal 6 karakter.");
  if (!ROLES.includes(role as Role)) throw new Error("Peran tidak valid.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email ini sudah dipakai pengguna lain.");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { name, email, passwordHash, role, employeeId, pageAccess },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      detail: JSON.stringify({ email, role, customAccess: pageAccess.length > 0 ? pageAccess : undefined }),
    },
  });

  revalidatePath("/pengguna");
}

export async function updateUser(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";
  const employeeId = String(formData.get("employeeId") ?? "") || null;
  const pageAccess = parsePageAccess(formData);

  if (!userId) throw new Error("Pengguna tidak ditemukan.");
  if (!name) throw new Error("Nama wajib diisi.");
  if (!ROLES.includes(role as Role)) throw new Error("Peran tidak valid.");

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Pengguna tidak ditemukan.");
  if (target.id === session.user.id && !active) {
    throw new Error("Tidak bisa menonaktifkan akun sendiri.");
  }
  if (target.id === session.user.id && role !== "ADMIN") {
    throw new Error("Tidak bisa mengubah peran akun sendiri dari Admin.");
  }

  await db.user.update({
    where: { id: userId },
    data: { name, role, active, employeeId, pageAccess },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "user.update",
      entity: "User",
      entityId: userId,
      detail: JSON.stringify({ role, active, customAccess: pageAccess.length > 0 ? pageAccess : undefined }),
    },
  });

  revalidatePath("/pengguna");
}

export async function resetUserPassword(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId) throw new Error("Pengguna tidak ditemukan.");
  if (password.length < 6) throw new Error("Password minimal 6 karakter.");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "user.passwordReset", entity: "User", entityId: userId },
  });

  revalidatePath("/pengguna");
}
