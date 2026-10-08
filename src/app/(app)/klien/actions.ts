"use server";

import { UserError } from "@/lib/userError";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/authz";
import { MBP_OFFICE_DENY } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { baseSalary } from "@/lib/payroll";
import { invoiceBjTotal, invoiceBjPpn } from "@/lib/finance";
import { suggestNextAccountCode } from "@/lib/coa";
import { nextInvoiceBjNo, lastOutsourcingInvoiceSeq, retryOnDuplicateNumber } from "@/lib/docNumber";
import { assertPeriodOpen } from "@/lib/periodLock";

// Invoice status only ever moves forward one step; lunas and dibatalkan are
// terminal (a paid invoice is reversed with "Batalkan", never re-paid).
const NEXT_INVOICE_STATUS: Record<string, "terkirim" | "lunas" | undefined> = { draft: "terkirim", terkirim: "lunas" };
const STATUS_CHANGED_MESSAGE = "Status invoice ini sudah berubah (mungkin baru diproses orang lain) — muat ulang halaman.";

const PPN_ACCOUNT_NAME = "Utang PPN Keluaran";
const ppnDesc = (invoiceNo: string) => "PPN Keluaran " + invoiceNo;

// The Kewajiban account PPN collected on invoices is parked in until it's
// paid on to the tax office (a manual Kas "keluar" on the same account).
// Created on first use with the next free 2xxx code, like other self-heal
// COA labels in this app.
async function ppnAccount() {
  const existing = await db.account.findFirst({ where: { name: PPN_ACCOUNT_NAME, type: "kewajiban" } });
  if (existing) return existing;
  const accounts = await db.account.findMany({ select: { code: true } });
  try {
    return await db.account.create({ data: { code: suggestNextAccountCode(accounts, "kewajiban"), name: PPN_ACCOUNT_NAME, type: "kewajiban" } });
  } catch {
    return db.account.findFirst({ where: { name: PPN_ACCOUNT_NAME, type: "kewajiban" } });
  }
}

export async function addClient(formData: FormData) {
  await requireAccess("/klien");

  const name = String(formData.get("name") ?? "").trim();
  const pic = String(formData.get("pic") ?? "").trim();
  const feeType = String(formData.get("feeType") ?? "percent");
  const feeValue = Math.max(0, parseInt(String(formData.get("feeValue") ?? "0"), 10) || 0);
  if (!name) throw new UserError("Nama klien wajib diisi.");

  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);

  await db.client.create({
    data: { name, pic, feeType, feeValue, contractStart: now, contractEnd: nextYear },
  });

  revalidatePath("/klien");
}

export async function updateClient(id: string, formData: FormData) {
  const session = await requireAccess("/klien");

  const name = String(formData.get("name") ?? "").trim();
  const pic = String(formData.get("pic") ?? "").trim();
  const picPhone = String(formData.get("picPhone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const feeType = String(formData.get("feeType") ?? "percent");
  const feeValue = Math.max(0, parseInt(String(formData.get("feeValue") ?? "0"), 10) || 0);
  if (!name) throw new UserError("Nama klien wajib diisi.");

  await db.client.update({
    where: { id },
    data: { name, pic, picPhone, address, feeType, feeValue },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "client.update", entity: "Client", entityId: id },
  });

  revalidatePath("/klien");
}

// Blocked whenever the client still has employees or invoices attached —
// deleting it out from under those would either orphan a foreign key
// (Prisma/Postgres would just reject it) or silently erase billing history.
// Reassign/remove those first, same guard rail used for invoices/payables
// throughout this module.
export async function deleteClient(id: string) {
  const session = await requireAccess("/klien");

  const client = await db.client.findUnique({
    where: { id },
    include: { _count: { select: { employees: true, invoices: true, invoicesBj: true } } },
  });
  if (!client) return;

  const { employees, invoices, invoicesBj } = client._count;
  if (employees > 0 || invoices > 0 || invoicesBj > 0) {
    const parts = [];
    if (employees > 0) parts.push(`${employees} karyawan`);
    if (invoices > 0) parts.push(`${invoices} invoice outsourcing`);
    if (invoicesBj > 0) parts.push(`${invoicesBj} invoice barang & jasa`);
    throw new UserError(`Klien tidak bisa dihapus — masih ada ${parts.join(", ")} yang terhubung. Pindahkan/hapus dulu sebelum menghapus klien ini.`);
  }

  await db.client.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "client.delete", entity: "Client", entityId: id, detail: client.name },
  });

  revalidatePath("/klien");
}

// Backs the invoice dialogs' client combobox: picking a name that already
// exists as a Client returns it as-is; picking a Site name (tempat kerja in
// Penggajian) that has no matching Client yet, or typing a brand-new name,
// creates a minimal Client row on the spot (fee info left at 0/default —
// editable later from the Klien page) so invoicing never blocks on having
// set that up first.
export async function findOrCreateClientByName(name: string): Promise<{ id: string; name: string }> {
  await requireAccess(["/klien", "/mbp"], { denyRoles: MBP_OFFICE_DENY });

  const trimmed = name.trim();
  if (!trimmed) throw new UserError("Nama klien wajib diisi.");

  const existing = await db.client.findFirst({ where: { name: { equals: trimmed, mode: "insensitive" } } });
  if (existing) return { id: existing.id, name: existing.name };

  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);

  const created = await db.client.create({
    data: { name: trimmed, pic: "", feeType: "percent", feeValue: 0, contractStart: now, contractEnd: nextYear },
  });

  revalidatePath("/klien");
  return { id: created.id, name: created.name };
}

export async function addInvoiceBj(formData: FormData) {
  const session = await requireAccess("/klien");

  const clientId = String(formData.get("clientId") ?? "");
  const withPpn = formData.get("withPpn") === "on";
  if (!clientId) throw new UserError("Klien wajib dipilih.");

  const items: { desc: string; qty: number; price: number }[] = [];
  for (let i = 1; formData.has(`desc${i}`); i++) {
    const desc = String(formData.get(`desc${i}`) ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(1, parseInt(String(formData.get(`qty${i}`) ?? "1"), 10) || 1);
    const price = Math.max(0, parseInt(String(formData.get(`price${i}`) ?? "0"), 10) || 0);
    items.push({ desc, qty, price });
  }
  if (items.length === 0) throw new UserError("Minimal 1 item wajib diisi.");

  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const discountDesc = String(formData.get("discountDesc") ?? "").trim() || null;
  const discountPercent = Math.min(100, Math.max(0, parseInt(String(formData.get("discountPercent") ?? "0"), 10) || 0));
  const signerName = String(formData.get("signerName") ?? "").trim() || null;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const { invoiceNo } = await retryOnDuplicateNumber(async () => db.invoiceBj.create({
    data: {
      invoiceNo: await nextInvoiceBjNo(),
      clientId,
      date: new Date(),
      dueDate,
      withPpn,
      jobTitle,
      discountDesc,
      discountPercent,
      signerName,
      items: { create: items },
    },
  }));

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.create", entity: "InvoiceBj", entityId: invoiceNo },
  });

  revalidatePath("/klien");
}

// Only draft/terkirim invoices can be edited — same reasoning as delete:
// once "lunas", the amount is already posted to Kas, so changing items here
// would silently desync from what was actually recorded as paid.
export async function updateInvoiceBj(id: string, formData: FormData) {
  const session = await requireAccess("/klien");

  const existing = await db.invoiceBj.findUnique({ where: { id } });
  if (!existing) throw new UserError("Invoice tidak ditemukan.");
  if (existing.status === "lunas" || existing.status === "dibatalkan") {
    throw new UserError("Invoice yang sudah lunas/dibatalkan tidak bisa diedit.");
  }

  const clientId = String(formData.get("clientId") ?? "");
  const withPpn = formData.get("withPpn") === "on";
  if (!clientId) throw new UserError("Klien wajib dipilih.");

  const items: { desc: string; qty: number; price: number }[] = [];
  for (let i = 1; formData.has(`desc${i}`); i++) {
    const desc = String(formData.get(`desc${i}`) ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(1, parseInt(String(formData.get(`qty${i}`) ?? "1"), 10) || 1);
    const price = Math.max(0, parseInt(String(formData.get(`price${i}`) ?? "0"), 10) || 0);
    items.push({ desc, qty, price });
  }
  if (items.length === 0) throw new UserError("Minimal 1 item wajib diisi.");

  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const discountDesc = String(formData.get("discountDesc") ?? "").trim() || null;
  const discountPercent = Math.min(100, Math.max(0, parseInt(String(formData.get("discountPercent") ?? "0"), 10) || 0));
  const signerName = String(formData.get("signerName") ?? "").trim() || null;

  await db.invoiceBj.update({
    where: { id },
    data: {
      clientId,
      withPpn,
      jobTitle,
      discountDesc,
      discountPercent,
      signerName,
      items: { deleteMany: {}, create: items },
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.update", entity: "InvoiceBj", entityId: existing.invoiceNo },
  });

  revalidatePath("/klien");
}

export async function advanceInvoiceBjStatus(id: string, fromStatus: string) {
  await requireAccess("/klien");

  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { items: true, client: true } });
  if (!inv) return;
  // Only draft → terkirim → lunas moves forward. A stale tab (or a second
  // person) clicking "Tandai lunas" on an invoice that's already lunas — or
  // one that's been cancelled — used to fall through to "lunas" again and
  // post the payment to Kas a second time.
  // fromStatus is what the person was looking at: a stale tab that still
  // shows "Kirim tagihan" must not turn an already-sent invoice into lunas.
  if (inv.status !== fromStatus) throw new UserError(STATUS_CHANGED_MESSAGE);
  const next = NEXT_INVOICE_STATUS[inv.status];
  if (!next) throw new UserError(STATUS_CHANGED_MESSAGE);
  if (next === "lunas") await assertPeriodOpen();

  const total = invoiceBjTotal(inv.items, inv.discountPercent, inv.withPpn);
  const ppn = invoiceBjPpn(inv.items, inv.discountPercent, inv.withPpn);
  const [account, cashAccount, ppnAcc] = next === "lunas"
    ? await Promise.all([db.account.findUnique({ where: { code: "4001" } }), db.cashAccount.findFirst({ where: { kind: "besar" } }), ppn > 0 ? ppnAccount() : null])
    : [null, null, null];
  const keterangan = inv.client.name + (inv.jobTitle ? " — " + inv.jobTitle : "");

  await db.$transaction(async (tx) => {
    // Conditional on the status we just read, so of two concurrent clicks
    // only one wins the transition (and the Kas entry that comes with it).
    const moved = await tx.invoiceBj.updateMany({ where: { id, status: inv.status }, data: { status: next } });
    if (moved.count === 0) throw new UserError(STATUS_CHANGED_MESSAGE);
    if (account && cashAccount) {
      await tx.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembayaran " + inv.invoiceNo + " (" + keterangan + ")",
          amount: ppnAcc ? total - ppn : total,
          type: "masuk",
        },
      });
      if (ppnAcc) {
        await tx.transaction.create({
          data: { date: new Date(), accountCoaId: ppnAcc.id, cashAccountId: cashAccount.id, desc: ppnDesc(inv.invoiceNo), amount: ppn, type: "masuk" },
        });
      }
    }
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}

// Only draft/terkirim invoices can be deleted — once an invoice is "lunas"
// it's already posted a Transaction to Kas, so removing it here would leave
// that revenue entry orphaned/unexplained. Use cancelInvoiceBj instead for
// a paid invoice, which reverses the Kas entry properly.
export async function deleteInvoiceBj(id: string) {
  const session = await requireAccess("/klien");

  const inv = await db.invoiceBj.findUnique({ where: { id } });
  if (!inv) return;
  if (inv.status === "lunas") throw new UserError("Invoice yang sudah lunas tidak bisa dihapus — gunakan \"Batalkan\" supaya Kas ikut dikoreksi.");
  // A cancelled invoice still has its payment + reversal in Kas, so it stays
  // on record too (the list only offers Hapus for draft/terkirim).
  if (inv.status === "dibatalkan") throw new UserError("Invoice yang sudah dibatalkan tetap disimpan sebagai catatan karena sudah ada transaksinya di Kas.");

  await db.invoiceBj.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.delete", entity: "InvoiceBj", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
}

// Cancels an already-paid invoice by posting a reversing Transaction (same
// amount, keluar) to Kas and marking the invoice "dibatalkan" — a terminal
// status distinct from draft/terkirim/lunas so it's excluded from piutang
// aging and the Kirim/Tandai-lunas actions, but stays visible in the list
// (unlike delete) since real money already moved for it.
export async function cancelInvoiceBj(id: string) {
  const session = await requireAccess("/klien");

  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { items: true, client: true } });
  if (!inv) return;
  if (inv.status !== "lunas") throw new UserError("Invoice ini belum lunas — hapus langsung saja, tidak perlu dibatalkan.");
  await assertPeriodOpen();

  const total = invoiceBjTotal(inv.items, inv.discountPercent, inv.withPpn);
  const account = await db.account.findUnique({ where: { code: "4001" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
  // Reverse exactly what the payment posted: invoices paid before PPN was
  // split out booked the whole total to 4001.
  const ppnPosted = await db.transaction.findFirst({ where: { desc: ppnDesc(inv.invoiceNo), type: "masuk" } });
  const keterangan = inv.client.name + (inv.jobTitle ? " — " + inv.jobTitle : "");
  await db.$transaction(async (tx) => {
    const moved = await tx.invoiceBj.updateMany({ where: { id, status: "lunas" }, data: { status: "dibatalkan" } });
    if (moved.count === 0) throw new UserError(STATUS_CHANGED_MESSAGE);
    if (account && cashAccount) {
      await tx.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembatalan invoice " + inv.invoiceNo + " (" + keterangan + ")",
          amount: ppnPosted ? total - ppnPosted.amount : total,
          type: "keluar",
        },
      });
      if (ppnPosted) {
        await tx.transaction.create({
          data: { date: new Date(), accountCoaId: ppnPosted.accountCoaId, cashAccountId: cashAccount.id, desc: "Pembatalan " + ppnDesc(inv.invoiceNo), amount: ppnPosted.amount, type: "keluar" },
        });
      }
    }
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.cancel", entity: "InvoiceBj", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}

// ── Monthly outsourcing-fee invoices (per client, per period) ─────────

export async function generateInvoices(period: string) {
  const session = await requireAccess("/klien");
  if (!/^\d{4}-\d{2}$/.test(period)) throw new UserError("Periode tidak valid.");

  const clients = await db.client.findMany({
    include: { employees: { where: { status: "aktif" }, include: { salaryComponents: true } } },
  });

  let seq = await lastOutsourcingInvoiceSeq();
  let created = 0;

  for (const client of clients) {
    if (client.employees.length === 0) continue;

    const gajiTotal = client.employees.reduce((sum, e) => sum + baseSalary(e.salaryComponents), 0);
    const feeTotal = client.feeType === "percent"
      ? Math.round((gajiTotal * client.feeValue) / 100)
      : client.feeValue * client.employees.length;
    const total = gajiTotal + feeTotal;

    const existing = await db.invoice.findUnique({ where: { clientId_period: { clientId: client.id, period } } });
    if (existing) {
      await db.invoice.update({ where: { id: existing.id }, data: { gajiTotal, feeTotal, total } });
      continue;
    }

    seq += 1;
    const invoiceNo = "OS-" + period.replace("-", "") + "-" + String(seq).padStart(4, "0");
    const dueDate = new Date(`${period}-01T00:00:00`);
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(10);

    await db.invoice.create({
      data: { clientId: client.id, invoiceNo, period, gajiTotal, feeTotal, total, dueDate },
    });
    created += 1;
  }

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoice.generate", entity: "Invoice", entityId: period },
  });

  revalidatePath("/klien");
  return { created };
}

export async function advanceInvoiceStatus(id: string, fromStatus: string) {
  await requireAccess("/klien");

  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true } });
  if (!inv) return;
  // Same forward-only, one-winner transition as advanceInvoiceBjStatus.
  // fromStatus is what the person was looking at: a stale tab that still
  // shows "Kirim tagihan" must not turn an already-sent invoice into lunas.
  if (inv.status !== fromStatus) throw new UserError(STATUS_CHANGED_MESSAGE);
  const next = NEXT_INVOICE_STATUS[inv.status];
  if (!next) throw new UserError(STATUS_CHANGED_MESSAGE);
  if (next === "lunas") await assertPeriodOpen();
  const now = new Date();

  const [account, cashAccount] = next === "lunas"
    ? await Promise.all([db.account.findUnique({ where: { code: "4001" } }), db.cashAccount.findFirst({ where: { kind: "besar" } })])
    : [null, null];
  const periodLabel = new Date(inv.period + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const keterangan = inv.client.name + " — Jasa Outsourcing " + periodLabel;

  await db.$transaction(async (tx) => {
    const moved = await tx.invoice.updateMany({
      where: { id, status: inv.status },
      data: {
        status: next,
        sentAt: next === "terkirim" ? now : inv.sentAt,
        paidAt: next === "lunas" ? now : inv.paidAt,
      },
    });
    if (moved.count === 0) throw new UserError(STATUS_CHANGED_MESSAGE);
    if (account && cashAccount) {
      await tx.transaction.create({
        data: {
          date: now,
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembayaran " + inv.invoiceNo + " (" + keterangan + ")",
          amount: inv.total,
          type: "masuk",
        },
      });
    }
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}

// Tanggal dokumen invoice fisik diserahkan ke klien — dicatat terpisah dari
// jatuh tempo supaya aging piutang bisa membedakan "belum diserahkan" dari
// "sudah diserahkan tapi belum dibayar".
export async function setDocHandoverDate(type: "bj" | "outsourcing", id: string, dateRaw: string) {
  await requireAccess(["/klien", "/kas"]);

  const date = dateRaw ? new Date(dateRaw) : null;
  if (dateRaw && Number.isNaN(date?.getTime())) throw new UserError("Tanggal tidak valid.");

  if (type === "bj") {
    await db.invoiceBj.update({ where: { id }, data: { docHandoverDate: date } });
  } else {
    await db.invoice.update({ where: { id }, data: { docHandoverDate: date } });
  }

  revalidatePath("/klien");
  revalidatePath("/kas");
}

// Same delete rule as deleteInvoiceBj — draft/terkirim only, since "lunas"
// already posted a Transaction to Kas. Use cancelInvoice for a paid one.
export async function deleteInvoice(id: string) {
  const session = await requireAccess("/klien");

  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) return;
  if (inv.status === "lunas") throw new UserError("Invoice yang sudah lunas tidak bisa dihapus — gunakan \"Batalkan\" supaya Kas ikut dikoreksi.");
  // A cancelled invoice still has its payment + reversal in Kas, so it stays
  // on record too (the list only offers Hapus for draft/terkirim).
  if (inv.status === "dibatalkan") throw new UserError("Invoice yang sudah dibatalkan tetap disimpan sebagai catatan karena sudah ada transaksinya di Kas.");

  await db.invoice.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoice.delete", entity: "Invoice", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
}

// Same reversing-entry pattern as cancelInvoiceBj.
export async function cancelInvoice(id: string) {
  const session = await requireAccess("/klien");

  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true } });
  if (!inv) return;
  if (inv.status !== "lunas") throw new UserError("Invoice ini belum lunas — hapus langsung saja, tidak perlu dibatalkan.");
  await assertPeriodOpen();

  const account = await db.account.findUnique({ where: { code: "4001" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
  const periodLabel = new Date(inv.period + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const keterangan = inv.client.name + " — Jasa Outsourcing " + periodLabel;
  await db.$transaction(async (tx) => {
    const moved = await tx.invoice.updateMany({ where: { id, status: "lunas" }, data: { status: "dibatalkan" } });
    if (moved.count === 0) throw new UserError(STATUS_CHANGED_MESSAGE);
    if (account && cashAccount) {
      await tx.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembatalan invoice " + inv.invoiceNo + " (" + keterangan + ")",
          amount: inv.total,
          type: "keluar",
        },
      });
    }
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoice.cancel", entity: "Invoice", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}
