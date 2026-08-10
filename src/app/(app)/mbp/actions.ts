"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { findOrCreateClientByName } from "@/app/(app)/klien/actions";

// Field request for an item — pending office approval. Deliberately doesn't
// touch anything else yet (no Mbp created here); same reasoning as
// Gudang's requestItem: this only records that someone asked.
export async function addMbpRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const itemId = String(formData.get("itemId") ?? "").trim() || null;
  const qty = Math.max(1, parseInt(String(formData.get("qty") ?? "1"), 10) || 1);
  let requesterName = String(formData.get("requesterName") ?? "").trim();
  const siteName = String(formData.get("siteName") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  // A field employee's own account can only ever request as themselves —
  // re-derive from their linked Employee server-side rather than trusting
  // whatever the client posted, in case the requester field was tampered
  // with (the UI already hides/locks it, this is the actual enforcement).
  if (session.user.role === "EMPLOYEE") {
    const me = await db.user.findUnique({ where: { id: session.user.id }, select: { employee: { select: { name: true } } } });
    if (!me?.employee) throw new Error("Akun Anda belum terhubung ke data karyawan.");
    requesterName = me.employee.name;
  }
  if (!requesterName) throw new Error("Nama peminta wajib diisi.");

  let itemName: string;
  let unit: string;
  let cost: number;

  if (itemId) {
    const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Barang tidak ditemukan.");
    itemName = item.name;
    unit = item.unit;
    cost = item.price;
  } else {
    itemName = String(formData.get("itemName") ?? "").trim();
    unit = String(formData.get("unit") ?? "").trim() || "unit";
    cost = Math.max(0, parseInt(String(formData.get("cost") ?? "0"), 10) || 0);
    if (!itemName) throw new Error("Nama barang wajib diisi.");
  }

  const request = await db.mbpRequest.create({
    data: { itemId, itemName, unit, qty, cost, requesterName, siteName, note, createdById: session.user.id },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbpRequest.create", entity: "MbpRequest", entityId: request.id, detail: JSON.stringify({ itemName, qty, requesterName }) },
  });

  revalidatePath("/mbp");
}

export async function decideMbpRequest(id: string, decision: "disetujui" | "ditolak", note?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const request = await db.mbpRequest.findUnique({ where: { id } });
  if (!request) return;
  if (request.status !== "menunggu") throw new Error("Permintaan ini sudah diputuskan sebelumnya.");

  await db.mbpRequest.update({
    where: { id },
    data: { status: decision, decidedAt: new Date(), decisionNote: note?.trim() || null },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbpRequest." + decision, entity: "MbpRequest", entityId: id, detail: request.itemName },
  });

  revalidatePath("/mbp");
}

type MbpItemInput = { desc: string; qty: number; cost: number; price: number; sourceRequestId: string | null };

// Item rows are desc{i}/qty{i}/cost{i}/price{i}, same indexed-FormData shape
// as InvoiceBjFormFields — plus an optional sourceRequestId{i} when the row
// started life as a pulled-in approved MbpRequest (see CreateMbpDialog),
// so that request can be marked consumed once the Mbp is actually saved.
function parseMbpItems(formData: FormData): MbpItemInput[] {
  const items: MbpItemInput[] = [];
  for (let i = 1; formData.has(`desc${i}`); i++) {
    const desc = String(formData.get(`desc${i}`) ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(1, parseInt(String(formData.get(`qty${i}`) ?? "1"), 10) || 1);
    const cost = Math.max(0, parseInt(String(formData.get(`cost${i}`) ?? "0"), 10) || 0);
    const price = Math.max(0, parseInt(String(formData.get(`price${i}`) ?? "0"), 10) || 0);
    const sourceRequestId = String(formData.get(`sourceRequestId${i}`) ?? "").trim() || null;
    items.push({ desc, qty, cost, price, sourceRequestId });
  }
  return items;
}

async function nextMbpNo(): Promise<string> {
  const count = await db.mbp.count();
  const seq = String(count + 1).padStart(4, "0");
  const mmYY = String(new Date().getMonth() + 1).padStart(2, "0") + String(new Date().getFullYear()).slice(-2);
  return `${seq}-MBP-WSP-${mmYY}`;
}

export async function createMbp(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const clientNameManual = String(formData.get("clientNameManual") ?? "").trim() || null;
  if (!clientId && !clientNameManual) throw new Error("Klien wajib dipilih atau diisi manual.");

  const items = parseMbpItems(formData);
  if (items.length === 0) throw new Error("Minimal 1 item wajib diisi.");

  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const signerName = String(formData.get("signerName") ?? "").trim() || null;
  const withPpn = formData.get("withPpn") === "on";
  const ppnPercent = Math.max(0, parseInt(String(formData.get("ppnPercent") ?? "11"), 10) || 0);
  const mbpNo = await nextMbpNo();

  const mbp = await db.mbp.create({
    data: {
      mbpNo,
      clientId,
      clientNameManual: clientId ? null : clientNameManual,
      jobTitle,
      signerName,
      withPpn,
      ppnPercent,
      items: { create: items.map(({ desc, qty, cost, price }) => ({ desc, qty, cost, price })) },
    },
  });

  // Pulling a pending request into an Mbp *is* the ACC now — there's no
  // separate approve step in the Permintaan tab anymore. A request that
  // was already approved-but-unconsumed under the old flow is accepted
  // here too (status left as-is), so nothing legacy gets stranded.
  const sourceIds = items.map((i) => i.sourceRequestId).filter((v): v is string => !!v);
  if (sourceIds.length > 0) {
    await db.mbpRequest.updateMany({
      where: { id: { in: sourceIds }, mbpId: null },
      data: { mbpId: mbp.id, status: "disetujui", decidedAt: new Date() },
    });
  }

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbp.create", entity: "Mbp", entityId: mbp.id, detail: mbpNo },
  });

  revalidatePath("/mbp");
}

export async function updateMbp(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await db.mbp.findUnique({ where: { id } });
  if (!existing) throw new Error("MBP tidak ditemukan.");
  if (existing.status === "dibatalkan" || existing.invoiceBjId) {
    throw new Error("MBP yang sudah dibatalkan/dikonversi jadi invoice tidak bisa diedit.");
  }

  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const clientNameManual = String(formData.get("clientNameManual") ?? "").trim() || null;
  if (!clientId && !clientNameManual) throw new Error("Klien wajib dipilih atau diisi manual.");

  const items = parseMbpItems(formData);
  if (items.length === 0) throw new Error("Minimal 1 item wajib diisi.");

  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const signerName = String(formData.get("signerName") ?? "").trim() || null;
  const withPpn = formData.get("withPpn") === "on";
  const ppnPercent = Math.max(0, parseInt(String(formData.get("ppnPercent") ?? "11"), 10) || 0);

  // Same consumption rule as createMbp — a request pulled in during an
  // edit is locked to this MBP too (and ACC'd in the same step), so it
  // can't also end up in another one.
  const sourceIds = items.map((i) => i.sourceRequestId).filter((v): v is string => !!v);
  if (sourceIds.length > 0) {
    await db.mbpRequest.updateMany({
      where: { id: { in: sourceIds }, mbpId: null },
      data: { mbpId: id, status: "disetujui", decidedAt: new Date() },
    });
  }

  await db.mbp.update({
    where: { id },
    data: {
      clientId,
      clientNameManual: clientId ? null : clientNameManual,
      jobTitle,
      signerName,
      withPpn,
      ppnPercent,
      items: { deleteMany: {}, create: items.map(({ desc, qty, cost, price }) => ({ desc, qty, cost, price })) },
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbp.update", entity: "Mbp", entityId: id, detail: existing.mbpNo },
  });

  revalidatePath("/mbp");
}

const STATUS_FLOW: Record<string, string> = { draft: "terkirim", terkirim: "disetujui_klien" };

// Pure status cycle — unlike InvoiceBj's "lunas" step, MBP never touches
// Kas; the only downstream side effect happens later, in
// convertMbpToInvoice, once the client has actually said yes.
export async function advanceMbpStatus(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const mbp = await db.mbp.findUnique({ where: { id } });
  if (!mbp) return;
  const next = STATUS_FLOW[mbp.status];
  if (!next) throw new Error("Status MBP ini tidak bisa dilanjutkan lagi.");

  await db.mbp.update({ where: { id }, data: { status: next } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbp.advance", entity: "Mbp", entityId: id, detail: next },
  });

  revalidatePath("/mbp");
}

export async function rejectMbpByClient(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const mbp = await db.mbp.findUnique({ where: { id } });
  if (!mbp) return;
  if (mbp.status !== "terkirim") throw new Error("Hanya MBP yang sudah terkirim yang bisa ditandai ditolak klien.");

  // A rejected MBP is a dead end — the requests it pulled in should go
  // back to the pending pool so they're available for a fresh MBP
  // attempt (different pricing, different client, etc.), instead of
  // being permanently stuck pointing at an MBP that never became real.
  // Since pulling a request into an MBP is also what ACCs it now, undoing
  // that has to undo the ACC too — back to "menunggu", not left "disetujui"
  // with nothing attached.
  await db.$transaction([
    db.mbp.update({ where: { id }, data: { status: "ditolak_klien" } }),
    db.mbpRequest.updateMany({ where: { mbpId: id }, data: { mbpId: null, status: "menunggu", decidedAt: null, decisionNote: null } }),
  ]);

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbp.rejectByClient", entity: "Mbp", entityId: id },
  });

  revalidatePath("/mbp");
}

export async function cancelMbp(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const mbp = await db.mbp.findUnique({ where: { id } });
  if (!mbp) return;
  if (mbp.status === "dibatalkan") throw new Error("MBP ini sudah dibatalkan sebelumnya.");
  if (mbp.invoiceBjId) throw new Error("MBP ini sudah dikonversi jadi invoice — tidak bisa dibatalkan dari sini.");

  // Same reasoning as rejectMbpByClient — cancelling shouldn't permanently
  // lock the requests this MBP had pulled in, and undoing the pull undoes
  // the ACC too.
  await db.$transaction([
    db.mbp.update({ where: { id }, data: { status: "dibatalkan" } }),
    db.mbpRequest.updateMany({ where: { mbpId: id }, data: { mbpId: null, status: "menunggu", decidedAt: null, decisionNote: null } }),
  ]);

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbp.cancel", entity: "Mbp", entityId: id, detail: mbp.mbpNo },
  });

  revalidatePath("/mbp");
}

// The hand-off into real billing: builds an InvoiceBj from this Mbp's items
// (desc/qty/price — cost never crosses over) using the exact same invoiceNo
// generator as addInvoiceBj in klien/actions.ts. If the Mbp was only ever
// linked to a manual client name (no real Client record yet), resolves/
// creates one via findOrCreateClientByName — reused as-is, not duplicated.
export async function convertMbpToInvoice(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const mbp = await db.mbp.findUnique({ where: { id }, include: { items: true } });
  if (!mbp) throw new Error("MBP tidak ditemukan.");
  if (mbp.status !== "disetujui_klien") throw new Error("Hanya MBP yang sudah disetujui klien yang bisa dijadikan invoice.");
  if (mbp.invoiceBjId) throw new Error("MBP ini sudah pernah dikonversi jadi invoice.");
  if (mbp.items.length === 0) throw new Error("MBP ini tidak punya item.");

  let clientId = mbp.clientId;
  if (!clientId) {
    if (!mbp.clientNameManual) throw new Error("MBP ini belum punya klien — lengkapi dulu sebelum dikonversi.");
    const client = await findOrCreateClientByName(mbp.clientNameManual);
    clientId = client.id;
  }

  const count = await db.invoiceBj.count();
  const seq = String(count + 1).padStart(4, "0");
  const mmYY = String(new Date().getMonth() + 1).padStart(2, "0") + String(new Date().getFullYear()).slice(-2);
  const invoiceNo = `${seq}-INV-WSP-${mmYY}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const invoice = await db.invoiceBj.create({
    data: {
      invoiceNo,
      clientId,
      date: new Date(),
      dueDate,
      withPpn: mbp.withPpn,
      jobTitle: mbp.jobTitle,
      signerName: mbp.signerName,
      items: { create: mbp.items.map((i) => ({ desc: i.desc, qty: i.qty, price: i.price })) },
    },
  });

  await db.mbp.update({ where: { id }, data: { clientId, invoiceBjId: invoice.id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "mbp.convertToInvoice", entity: "Mbp", entityId: id, detail: JSON.stringify({ mbpNo: mbp.mbpNo, invoiceNo }) },
  });

  revalidatePath("/mbp");
  revalidatePath("/klien");
}

// Fetch-and-setState refresh, same pattern as fetchSalaryComponents in
// karyawan/actions.ts — called directly from client components right after
// a mutation instead of relying on revalidatePath + the implicit page
// refresh that follows a Server Action, which doesn't reliably reach an
// already-mounted client tree here. Scoped the same way the page itself is:
// an EMPLOYEE only ever gets their own requests back, with cost zeroed out
// so it's not just hidden in the UI but never actually reaches their
// browser — pricing/markup is office business, not the requester's.
export async function fetchMbpRequests() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const isEmployee = session.user.role === "EMPLOYEE";
  const where = isEmployee ? { createdById: session.user.id } : {};
  const rows = await db.mbpRequest.findMany({ where, orderBy: { createdAt: "desc" } });
  return isEmployee ? rows.map((r) => ({ ...r, cost: 0 })) : rows;
}

export async function fetchMbps() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const mbpsRaw = await db.mbp.findMany({ include: { items: true, client: true }, orderBy: { createdAt: "desc" } });
  return mbpsRaw.map((m) => ({
    id: m.id,
    mbpNo: m.mbpNo,
    clientId: m.clientId,
    clientNameManual: m.clientNameManual,
    clientName: m.client?.name ?? m.clientNameManual ?? "-",
    date: m.date,
    jobTitle: m.jobTitle,
    signerName: m.signerName,
    withPpn: m.withPpn,
    ppnPercent: m.ppnPercent,
    status: m.status,
    invoiceBjId: m.invoiceBjId,
    items: m.items,
  }));
}
