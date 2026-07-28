"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const ACTIVE_STAGES = ["kontak_awal", "penawaran", "negosiasi", "deal"];

export async function addLead(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const companyName = String(formData.get("companyName") ?? "").trim();
  const picName = String(formData.get("picName") ?? "").trim() || null;
  const picPhone = String(formData.get("picPhone") ?? "").trim() || null;
  const picEmail = String(formData.get("picEmail") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const estimatedValue = Math.max(0, parseInt(String(formData.get("estimatedValue") ?? "0"), 10) || 0);
  if (!companyName) throw new Error("Nama perusahaan wajib diisi.");

  const lead = await db.lead.create({
    data: { companyName, picName, picPhone, picEmail, address, estimatedValue, createdById: session.user.id },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "lead.create", entity: "Lead", entityId: lead.id, detail: companyName },
  });

  revalidatePath("/crm");
}

export async function updateLead(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await db.lead.findUnique({ where: { id } });
  if (!existing) throw new Error("Prospek tidak ditemukan.");
  if (existing.clientId) throw new Error("Prospek yang sudah jadi klien tidak bisa diedit lagi.");

  const companyName = String(formData.get("companyName") ?? "").trim();
  const picName = String(formData.get("picName") ?? "").trim() || null;
  const picPhone = String(formData.get("picPhone") ?? "").trim() || null;
  const picEmail = String(formData.get("picEmail") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const estimatedValue = Math.max(0, parseInt(String(formData.get("estimatedValue") ?? "0"), 10) || 0);
  if (!companyName) throw new Error("Nama perusahaan wajib diisi.");

  await db.lead.update({
    where: { id },
    data: { companyName, picName, picPhone, picEmail, address, estimatedValue },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "lead.update", entity: "Lead", entityId: id, detail: companyName },
  });

  revalidatePath("/crm");
}

export async function addLeadActivity(leadId: string, note: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const trimmed = note.trim();
  if (!trimmed) throw new Error("Catatan tidak boleh kosong.");

  await db.leadActivity.create({ data: { leadId, note: trimmed, createdById: session.user.id } });

  revalidatePath("/crm");
}

// Direct set, not a linear "next stage" button — a real pipeline moves
// backward too (mis. negosiasi mundur ke penawaran lagi). "batal" isn't a
// valid target here on purpose — see markLeadLost for that, which captures
// a reason the same way MBP's rejectMbpByClient does.
export async function setLeadStage(id: string, stage: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!ACTIVE_STAGES.includes(stage)) throw new Error("Tahap tidak valid.");

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return;
  if (lead.clientId) throw new Error("Prospek yang sudah jadi klien tidak bisa diubah tahapnya lagi.");

  await db.lead.update({ where: { id }, data: { stage } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "lead.setStage", entity: "Lead", entityId: id, detail: stage },
  });

  revalidatePath("/crm");
}

export async function markLeadLost(id: string, reason: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return;
  if (lead.clientId) throw new Error("Prospek yang sudah jadi klien tidak bisa ditandai batal.");

  await db.lead.update({ where: { id }, data: { stage: "batal", lostReason: reason.trim() || null } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "lead.markLost", entity: "Lead", entityId: id, detail: reason },
  });

  revalidatePath("/crm");
}

// Keeps lostReason as history rather than clearing it — same "don't
// destroy the audit trail" reasoning used everywhere else in this app
// (e.g. InventoryRequest's cancel-with-reversing-entry keeps the original).
export async function reopenLead(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return;
  if (lead.stage !== "batal") throw new Error("Hanya prospek berstatus \"Batal\" yang bisa dibuka lagi.");

  await db.lead.update({ where: { id }, data: { stage: "kontak_awal" } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "lead.reopen", entity: "Lead", entityId: id },
  });

  revalidatePath("/crm");
}

// The hand-off into real client data: builds a Client directly from the
// Lead's own fields (richer than findOrCreateClientByName's bare-name
// signature, so not reused directly) — same 1-year-placeholder contract
// window convention used there.
export async function convertLeadToClient(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Prospek tidak ditemukan.");
  if (lead.stage !== "deal") throw new Error("Hanya prospek berstatus \"Deal\" yang bisa dijadikan klien.");
  if (lead.clientId) throw new Error("Prospek ini sudah pernah dijadikan klien.");

  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);

  const client = await db.client.create({
    data: {
      name: lead.companyName,
      pic: lead.picName ?? "",
      picPhone: lead.picPhone,
      address: lead.address,
      feeType: "percent",
      feeValue: 0,
      contractStart: now,
      contractEnd: nextYear,
    },
  });

  await db.lead.update({ where: { id }, data: { clientId: client.id, convertedAt: now } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "lead.convertToClient", entity: "Lead", entityId: id, detail: JSON.stringify({ companyName: lead.companyName, clientId: client.id }) },
  });

  revalidatePath("/crm");
  revalidatePath("/klien");
}

// Fetch-and-setState refresh — same reasoning as fetchMbpRequests/fetchMbps
// in mbp/actions.ts: revalidatePath + the implicit page refresh a Server
// Action normally triggers doesn't reliably reach an already-mounted
// client tree here.
export async function fetchLeads() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.lead.findMany({
    include: { activities: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
}
