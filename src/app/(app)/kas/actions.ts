"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { monthKey } from "@/lib/finance";

async function assertPeriodOpen(date: Date) {
  const period = monthKey(date);
  const closed = await db.closedPeriod.findUnique({ where: { period } });
  if (closed) throw new Error(`Periode ${period} sudah ditutup — buka kembali periode tersebut dulu untuk mencatat transaksi baru.`);
}

export async function closePeriod(period: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");

  await db.closedPeriod.upsert({
    where: { period },
    update: {},
    create: { period, closedBy: session.user.id },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "period.close", entity: "ClosedPeriod", entityId: period },
  });

  revalidatePath("/kas");
}

export async function reopenPeriod(period: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.closedPeriod.deleteMany({ where: { period } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "period.reopen", entity: "ClosedPeriod", entityId: period },
  });

  revalidatePath("/kas");
}

export async function addTransaction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await assertPeriodOpen(new Date());

  const accountCoaId = String(formData.get("accountCoaId") ?? "");
  const cashAccountId = String(formData.get("cashAccountId") ?? "");
  const desc = String(formData.get("desc") ?? "").trim() || "Transaksi kas";
  const amount = Math.max(0, parseInt(String(formData.get("amount") ?? "0"), 10) || 0);
  const type = String(formData.get("type") ?? "keluar");
  const file = formData.get("attachment") as File | null;

  if (!accountCoaId || !cashAccountId || !amount) {
    throw new Error("Akun, rekening, dan jumlah wajib diisi.");
  }

  let attachmentUrl: string | null = null;
  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const safeName = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, safeName), bytes);
    attachmentUrl = "/uploads/" + safeName;
  }

  const tx = await db.transaction.create({
    data: { date: new Date(), accountCoaId, cashAccountId, desc, amount, type, attachmentUrl },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "transaction.create", entity: "Transaction", entityId: tx.id },
  });

  revalidatePath("/kas");
  revalidatePath("/");
}

export async function updateTransaction(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await db.transaction.findUnique({ where: { id } });
  if (!existing) throw new Error("Transaksi tidak ditemukan.");

  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : existing.date;
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal tidak valid.");

  // A correction can move a transaction across periods — both the period it
  // used to belong to and the one it's moving into must still be open.
  await assertPeriodOpen(existing.date);
  await assertPeriodOpen(date);

  const accountCoaId = String(formData.get("accountCoaId") ?? "");
  const cashAccountId = String(formData.get("cashAccountId") ?? "");
  const desc = String(formData.get("desc") ?? "").trim() || "Transaksi kas";
  const amount = Math.max(0, parseInt(String(formData.get("amount") ?? "0"), 10) || 0);
  const type = String(formData.get("type") ?? "keluar");

  if (!accountCoaId || !cashAccountId || !amount) {
    throw new Error("Akun, rekening, dan jumlah wajib diisi.");
  }

  await db.transaction.update({
    where: { id },
    data: { date, accountCoaId, cashAccountId, desc, amount, type },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "transaction.update", entity: "Transaction", entityId: id },
  });

  revalidatePath("/kas");
  revalidatePath("/");
}

export async function addAccount(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "keluar");
  if (!code || !name) throw new Error("Kode dan nama akun wajib diisi.");

  await db.account.create({ data: { code, name, type } });
  revalidatePath("/kas");
}

export async function setBudget(accountId: string, budget: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.account.update({ where: { id: accountId }, data: { budget } });
  revalidatePath("/kas");
}

// Codes several actions across the app look up directly (bayarGaji, THR,
// bonus, penugasan tambahan, hutang usaha, pembayaran invoice, transfer
// antar rekening) — those postings fail silently (an `if (account && ...)`
// guard just skips the Kas entry) if the code goes missing, so renaming or
// deleting these specific ones is blocked rather than breaking Kas posting
// invisibly.
const PROTECTED_ACCOUNT_CODES = ["4001", "5001", "5007", "5008", "5009", "5010", "5011", "9001"];

export async function updateAccount(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const account = await db.account.findUnique({ where: { id } });
  if (!account) throw new Error("Akun tidak ditemukan.");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? account.type);
  if (!name) throw new Error("Nama akun wajib diisi.");
  if (PROTECTED_ACCOUNT_CODES.includes(account.code) && type !== account.type) {
    throw new Error(`Akun ${account.code} dipakai otomatis oleh sistem — jenisnya (masuk/keluar) tidak bisa diubah.`);
  }

  await db.account.update({ where: { id }, data: { name, type } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "account.update", entity: "Account", entityId: id },
  });

  revalidatePath("/kas");
}

export async function deleteAccount(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const account = await db.account.findUnique({ where: { id }, include: { _count: { select: { transactions: true } } } });
  if (!account) return;

  if (PROTECTED_ACCOUNT_CODES.includes(account.code)) {
    throw new Error(`Akun ${account.code} · ${account.name} dipakai otomatis oleh sistem (gaji, THR, bonus, dll) dan tidak bisa dihapus.`);
  }
  if (account._count.transactions > 0) {
    throw new Error(`Akun tidak bisa dihapus — masih ada ${account._count.transactions} transaksi yang tercatat di akun ini.`);
  }

  await db.account.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "account.delete", entity: "Account", entityId: id, detail: `${account.code} ${account.name}` },
  });

  revalidatePath("/kas");
}

export async function addPayable(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const vendorName = String(formData.get("vendorName") ?? "").trim();
  const desc = String(formData.get("desc") ?? "").trim() || "-";
  const amount = Math.max(0, parseInt(String(formData.get("amount") ?? "0"), 10) || 0);
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  if (!vendorName || !amount || !dueDateRaw) throw new Error("Vendor, jumlah, dan jatuh tempo wajib diisi.");

  await db.payable.create({ data: { vendorName, desc, amount, dueDate: new Date(dueDateRaw) } });
  revalidatePath("/kas");
}

export async function payPayable(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await assertPeriodOpen(new Date());

  const payable = await db.payable.findUnique({ where: { id } });
  if (!payable || payable.status === "lunas") return;

  const account = await db.account.findFirst({ where: { code: "5009" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });
  if (account && cashAccount) {
    await db.transaction.create({
      data: {
        date: new Date(),
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Bayar hutang — " + payable.vendorName + " (" + payable.desc + ")",
        amount: payable.amount,
        type: "keluar",
      },
    });
  }

  await db.payable.update({ where: { id }, data: { status: "lunas", paidAt: new Date() } });
  revalidatePath("/kas");
}

export async function addTransfer(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await assertPeriodOpen(new Date());

  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  const amount = Math.max(0, parseInt(String(formData.get("amount") ?? "0"), 10) || 0);
  if (!fromId || !toId || fromId === toId || !amount) throw new Error("Rekening dan jumlah tidak valid.");

  let transferAccount = await db.account.findFirst({ where: { name: "Transfer Antar Rekening" } });
  if (!transferAccount) {
    transferAccount = await db.account.create({
      data: { code: "9001", name: "Transfer Antar Rekening", type: "keluar" },
    });
  }

  const [from, to] = await Promise.all([
    db.cashAccount.findUnique({ where: { id: fromId } }),
    db.cashAccount.findUnique({ where: { id: toId } }),
  ]);
  if (!from || !to) throw new Error("Rekening tidak ditemukan.");

  await db.$transaction([
    db.transaction.create({
      data: { date: new Date(), accountCoaId: transferAccount.id, cashAccountId: fromId, desc: "Transfer ke " + to.name, amount, type: "keluar", isTransfer: true },
    }),
    db.transaction.create({
      data: { date: new Date(), accountCoaId: transferAccount.id, cashAccountId: toId, desc: "Transfer dari " + from.name, amount, type: "masuk", isTransfer: true },
    }),
  ]);

  revalidatePath("/kas");
}
