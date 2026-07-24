"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { baseSalary } from "@/lib/payroll";
import { invoiceBjTotal } from "@/lib/finance";

export async function addClient(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const pic = String(formData.get("pic") ?? "").trim();
  const feeType = String(formData.get("feeType") ?? "percent");
  const feeValue = Math.max(0, parseInt(String(formData.get("feeValue") ?? "0"), 10) || 0);
  if (!name) throw new Error("Nama klien wajib diisi.");

  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);

  await db.client.create({
    data: { name, pic, feeType, feeValue, contractStart: now, contractEnd: nextYear },
  });

  revalidatePath("/klien");
}

export async function updateClient(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const pic = String(formData.get("pic") ?? "").trim();
  const picPhone = String(formData.get("picPhone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const feeType = String(formData.get("feeType") ?? "percent");
  const feeValue = Math.max(0, parseInt(String(formData.get("feeValue") ?? "0"), 10) || 0);
  if (!name) throw new Error("Nama klien wajib diisi.");

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

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
    throw new Error(`Klien tidak bisa dihapus — masih ada ${parts.join(", ")} yang terhubung. Pindahkan/hapus dulu sebelum menghapus klien ini.`);
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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama klien wajib diisi.");

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const clientId = String(formData.get("clientId") ?? "");
  const withPpn = formData.get("withPpn") === "on";
  if (!clientId) throw new Error("Klien wajib dipilih.");

  const items: { desc: string; qty: number; price: number }[] = [];
  for (let i = 1; formData.has(`desc${i}`); i++) {
    const desc = String(formData.get(`desc${i}`) ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(1, parseInt(String(formData.get(`qty${i}`) ?? "1"), 10) || 1);
    const price = Math.max(0, parseInt(String(formData.get(`price${i}`) ?? "0"), 10) || 0);
    items.push({ desc, qty, price });
  }
  if (items.length === 0) throw new Error("Minimal 1 item wajib diisi.");

  const jobTitle = String(formData.get("jobTitle") ?? "").trim() || null;
  const discountDesc = String(formData.get("discountDesc") ?? "").trim() || null;
  const discountPercent = Math.min(100, Math.max(0, parseInt(String(formData.get("discountPercent") ?? "0"), 10) || 0));
  const signerName = String(formData.get("signerName") ?? "").trim() || null;

  const count = await db.invoiceBj.count();
  const seq = String(count + 1).padStart(4, "0");
  const mmYY = String(new Date().getMonth() + 1).padStart(2, "0") + String(new Date().getFullYear()).slice(-2);
  const invoiceNo = `${seq}-INV-WSP-${mmYY}`;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  await db.invoiceBj.create({
    data: {
      invoiceNo,
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
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.create", entity: "InvoiceBj", entityId: invoiceNo },
  });

  revalidatePath("/klien");
}

// Only draft/terkirim invoices can be edited — same reasoning as delete:
// once "lunas", the amount is already posted to Kas, so changing items here
// would silently desync from what was actually recorded as paid.
export async function updateInvoiceBj(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await db.invoiceBj.findUnique({ where: { id } });
  if (!existing) throw new Error("Invoice tidak ditemukan.");
  if (existing.status === "lunas" || existing.status === "dibatalkan") {
    throw new Error("Invoice yang sudah lunas/dibatalkan tidak bisa diedit.");
  }

  const clientId = String(formData.get("clientId") ?? "");
  const withPpn = formData.get("withPpn") === "on";
  if (!clientId) throw new Error("Klien wajib dipilih.");

  const items: { desc: string; qty: number; price: number }[] = [];
  for (let i = 1; formData.has(`desc${i}`); i++) {
    const desc = String(formData.get(`desc${i}`) ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(1, parseInt(String(formData.get(`qty${i}`) ?? "1"), 10) || 1);
    const price = Math.max(0, parseInt(String(formData.get(`price${i}`) ?? "0"), 10) || 0);
    items.push({ desc, qty, price });
  }
  if (items.length === 0) throw new Error("Minimal 1 item wajib diisi.");

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

export async function advanceInvoiceBjStatus(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { items: true, client: true } });
  if (!inv) return;

  const next = inv.status === "draft" ? "terkirim" : "lunas";

  if (next === "lunas") {
    const total = invoiceBjTotal(inv.items, inv.discountPercent, inv.withPpn);
    const account = await db.account.findUnique({ where: { code: "4001" } });
    const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
    const keterangan = inv.client.name + (inv.jobTitle ? " — " + inv.jobTitle : "");
    if (account && cashAccount) {
      await db.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembayaran " + inv.invoiceNo + " (" + keterangan + ")",
          amount: total,
          type: "masuk",
        },
      });
    }
  }

  await db.invoiceBj.update({ where: { id }, data: { status: next } });
  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}

// Only draft/terkirim invoices can be deleted — once an invoice is "lunas"
// it's already posted a Transaction to Kas, so removing it here would leave
// that revenue entry orphaned/unexplained. Use cancelInvoiceBj instead for
// a paid invoice, which reverses the Kas entry properly.
export async function deleteInvoiceBj(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoiceBj.findUnique({ where: { id } });
  if (!inv) return;
  if (inv.status === "lunas") throw new Error("Invoice yang sudah lunas tidak bisa dihapus — gunakan \"Batalkan\" supaya Kas ikut dikoreksi.");

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { items: true, client: true } });
  if (!inv) return;
  if (inv.status !== "lunas") throw new Error("Invoice ini belum lunas — hapus langsung saja, tidak perlu dibatalkan.");

  const total = invoiceBjTotal(inv.items, inv.discountPercent, inv.withPpn);
  const account = await db.account.findUnique({ where: { code: "4001" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
  const keterangan = inv.client.name + (inv.jobTitle ? " — " + inv.jobTitle : "");
  if (account && cashAccount) {
    await db.transaction.create({
      data: {
        date: new Date(),
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Pembatalan invoice " + inv.invoiceNo + " (" + keterangan + ")",
        amount: total,
        type: "keluar",
      },
    });
  }

  await db.invoiceBj.update({ where: { id }, data: { status: "dibatalkan" } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.cancel", entity: "InvoiceBj", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}

// ── Monthly outsourcing-fee invoices (per client, per period) ─────────

export async function generateInvoices(period: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");

  const clients = await db.client.findMany({
    include: { employees: { where: { status: "aktif" }, include: { salaryComponents: true } } },
  });

  const existingCount = await db.invoice.count();
  let seq = existingCount;
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

export async function advanceInvoiceStatus(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true } });
  if (!inv) return;

  const next = inv.status === "draft" ? "terkirim" : "lunas";
  const now = new Date();

  if (next === "lunas") {
    const account = await db.account.findUnique({ where: { code: "4001" } });
    const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
    const periodLabel = new Date(inv.period + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const keterangan = inv.client.name + " — Jasa Outsourcing " + periodLabel;
    if (account && cashAccount) {
      await db.transaction.create({
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
  }

  await db.invoice.update({
    where: { id },
    data: {
      status: next,
      sentAt: next === "terkirim" ? now : inv.sentAt,
      paidAt: next === "lunas" ? now : inv.paidAt,
    },
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}

// Tanggal dokumen invoice fisik diserahkan ke klien — dicatat terpisah dari
// jatuh tempo supaya aging piutang bisa membedakan "belum diserahkan" dari
// "sudah diserahkan tapi belum dibayar".
export async function setDocHandoverDate(type: "bj" | "outsourcing", id: string, dateRaw: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const date = dateRaw ? new Date(dateRaw) : null;
  if (dateRaw && Number.isNaN(date?.getTime())) throw new Error("Tanggal tidak valid.");

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
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) return;
  if (inv.status === "lunas") throw new Error("Invoice yang sudah lunas tidak bisa dihapus — gunakan \"Batalkan\" supaya Kas ikut dikoreksi.");

  await db.invoice.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoice.delete", entity: "Invoice", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
}

// Same reversing-entry pattern as cancelInvoiceBj.
export async function cancelInvoice(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true } });
  if (!inv) return;
  if (inv.status !== "lunas") throw new Error("Invoice ini belum lunas — hapus langsung saja, tidak perlu dibatalkan.");

  const account = await db.account.findUnique({ where: { code: "4001" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
  const periodLabel = new Date(inv.period + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const keterangan = inv.client.name + " — Jasa Outsourcing " + periodLabel;
  if (account && cashAccount) {
    await db.transaction.create({
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

  await db.invoice.update({ where: { id }, data: { status: "dibatalkan" } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoice.cancel", entity: "Invoice", entityId: inv.invoiceNo },
  });

  revalidatePath("/klien");
  revalidatePath("/kas");
  revalidatePath("/");
}
