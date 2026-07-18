"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { baseSalary } from "@/lib/payroll";

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

export async function addInvoiceBj(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const clientId = String(formData.get("clientId") ?? "");
  const withPpn = formData.get("withPpn") === "on";
  if (!clientId) throw new Error("Klien wajib dipilih.");

  const items: { desc: string; qty: number; price: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const desc = String(formData.get(`desc${i}`) ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(1, parseInt(String(formData.get(`qty${i}`) ?? "1"), 10) || 1);
    const price = Math.max(0, parseInt(String(formData.get(`price${i}`) ?? "0"), 10) || 0);
    items.push({ desc, qty, price });
  }
  if (items.length === 0) throw new Error("Minimal 1 item wajib diisi.");

  const count = await db.invoiceBj.count();
  const invoiceNo = "INV-" + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, "0") + String(count + 1).padStart(4, "0");

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  await db.invoiceBj.create({
    data: {
      invoiceNo,
      clientId,
      date: new Date(),
      dueDate,
      withPpn,
      items: { create: items },
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "invoiceBj.create", entity: "InvoiceBj", entityId: invoiceNo },
  });

  revalidatePath("/klien");
}

export async function advanceInvoiceBjStatus(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { items: true } });
  if (!inv) return;

  const next = inv.status === "draft" ? "terkirim" : "lunas";

  if (next === "lunas") {
    const subtotal = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
    const total = inv.withPpn ? Math.round(subtotal * 1.11) : subtotal;
    const account = await db.account.findUnique({ where: { code: "4001" } });
    const cashAccount = await db.cashAccount.findFirst();
    if (account && cashAccount) {
      await db.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembayaran " + inv.invoiceNo,
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

  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) return;

  const next = inv.status === "draft" ? "terkirim" : "lunas";
  const now = new Date();

  if (next === "lunas") {
    const account = await db.account.findUnique({ where: { code: "4001" } });
    const cashAccount = await db.cashAccount.findFirst();
    if (account && cashAccount) {
      await db.transaction.create({
        data: {
          date: now,
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: "Pembayaran " + inv.invoiceNo,
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
