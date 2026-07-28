"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addInventoryItem(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || "unit";
  const trackStock = formData.get("trackStock") !== "off";
  const qty = trackStock ? Math.max(0, parseInt(String(formData.get("qty") ?? "0"), 10) || 0) : 0;
  const price = Math.max(0, parseInt(String(formData.get("price") ?? "0"), 10) || 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const purpose = formData.get("purpose") === "mbp" ? "mbp" : "stock";
  if (!name) throw new Error("Nama barang wajib diisi.");

  const item = await db.inventoryItem.create({ data: { name, unit, qty, price, category, trackStock, purpose } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryItem.create", entity: "InventoryItem", entityId: item.id, detail: name },
  });

  revalidatePath("/gudang");
}

export async function updateInventoryItem(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || "unit";
  const trackStock = formData.get("trackStock") !== "off";
  const price = Math.max(0, parseInt(String(formData.get("price") ?? "0"), 10) || 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const purpose = formData.get("purpose") === "mbp" ? "mbp" : "stock";
  if (!name) throw new Error("Nama barang wajib diisi.");

  // Switching a physically-tracked item to "beli sesuai permintaan" resets
  // its qty to 0 — the number stops meaning anything once stock isn't
  // deducted per request anymore, so leaving a stale count around would
  // just be confusing on the item list.
  await db.inventoryItem.update({
    where: { id },
    data: { name, unit, price, category, trackStock, purpose, ...(trackStock ? {} : { qty: 0 }) },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryItem.update", entity: "InventoryItem", entityId: id },
  });

  revalidatePath("/gudang");
}

// Blocked once any request has ever been fulfilled against this item — the
// historical InventoryRequest rows snapshot their own itemName/unitPrice,
// but itemId itself would still dangle. Reference/master data otherwise,
// so freely deletable while unused.
export async function deleteInventoryItem(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const item = await db.inventoryItem.findUnique({ where: { id }, include: { _count: { select: { requests: true } } } });
  if (!item) return;
  if (item._count.requests > 0) {
    throw new Error(`Barang tidak bisa dihapus — sudah ada ${item._count.requests} riwayat pengambilan untuk barang ini.`);
  }

  await db.inventoryItem.delete({ where: { id } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryItem.delete", entity: "InventoryItem", entityId: id, detail: item.name },
  });

  revalidatePath("/gudang");
}

// Nonaktifkan/aktifkan barang tanpa menghapusnya — barang nonaktif tidak
// lagi bisa diambil (lihat requestItem), tapi riwayat pengambilannya yang
// lama tetap utuh, dan bisa diaktifkan lagi kapan saja.
export async function toggleInventoryItemActive(id: string, active: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.inventoryItem.update({ where: { id }, data: { active } });

  await db.auditLog.create({
    data: { userId: session.user.id, action: active ? "inventoryItem.activate" : "inventoryItem.deactivate", entity: "InventoryItem", entityId: id },
  });

  revalidatePath("/gudang");
}

// Adds to stock (barang masuk/pembelian baru) — separate from
// updateInventoryItem so editing the item's name/category can't
// accidentally also change the stock count.
export async function restockItem(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const item = await db.inventoryItem.findUnique({ where: { id } });
  if (!item) throw new Error("Barang tidak ditemukan.");
  if (!item.trackStock) throw new Error("Barang \"beli sesuai permintaan\" tidak punya stok untuk ditambah — barang ini selalu bisa diambil tanpa batas stok.");

  const addQty = Math.max(0, parseInt(String(formData.get("addQty") ?? "0"), 10) || 0);
  if (addQty <= 0) throw new Error("Jumlah tambahan stok harus lebih dari 0.");
  const newPriceRaw = String(formData.get("newPrice") ?? "").trim();

  await db.inventoryItem.update({
    where: { id },
    data: {
      qty: { increment: addQty },
      ...(newPriceRaw ? { price: Math.max(0, parseInt(newPriceRaw, 10) || 0) } : {}),
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryItem.restock", entity: "InventoryItem", entityId: id, detail: JSON.stringify({ addQty }) },
  });

  revalidatePath("/gudang");
}

// Records that someone has asked for an item (mis. AC 1 PK untuk kantor
// baru) — deliberately does NOT touch stock or Kas yet. A request can take
// time to actually fulfil (barang perlu dibeli/diantar dulu), so both only
// happen once it's marked "selesai" via completeInventoryRequest — same
// deferred-completion pattern as Assignment (addAssignment vs
// completeAssignment) elsewhere in this app.
export async function requestItem(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const itemId = String(formData.get("itemId") ?? "");
  const qty = Math.max(1, parseInt(String(formData.get("qty") ?? "1"), 10) || 1);
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const targetDateRaw = String(formData.get("targetDate") ?? "").trim();
  const targetDate = targetDateRaw ? new Date(targetDateRaw) : null;
  if (!itemId || !requesterName) throw new Error("Barang dan nama peminta wajib diisi.");

  const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Barang tidak ditemukan.");
  if (!item.active) throw new Error(`Barang "${item.name}" sedang nonaktif dan tidak bisa diambil.`);

  const request = await db.inventoryRequest.create({
    data: {
      itemId,
      itemName: item.name,
      qty,
      unitPrice: item.price,
      requesterName,
      department,
      note,
      targetDate,
      status: "berjalan",
      createdById: session.user.id,
    },
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryRequest.create", entity: "InventoryRequest", entityId: request.id, detail: JSON.stringify({ item: item.name, qty, requesterName }) },
  });

  revalidatePath("/gudang");
}

// Marks a "berjalan" request as fulfilled — this is the point stock
// actually gets deducted (if trackStock) and the Kas expense gets posted,
// re-checking stock here (not at request time) since other requests may
// have used it up in the meantime.
export async function completeInventoryRequest(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const request = await db.inventoryRequest.findUnique({ where: { id }, include: { item: true } });
  if (!request) return;
  if (request.status !== "berjalan") throw new Error("Hanya pengambilan berstatus \"Berjalan\" yang bisa diselesaikan.");

  const item = request.item;
  if (item.trackStock && request.qty > item.qty) {
    throw new Error(`Stok tidak cukup — sisa stok ${item.name} hanya ${item.qty} ${item.unit}.`);
  }

  const account = await db.account.findFirst({ where: { code: "5011" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });

  await db.$transaction(async (tx) => {
    if (item.trackStock) {
      await tx.inventoryItem.update({ where: { id: item.id }, data: { qty: { decrement: request.qty } } });
    }

    let transactionId: string | null = null;
    if (account && cashAccount) {
      const transaction = await tx.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: `Pengeluaran barang — ${request.itemName} ${request.qty} ${item.unit} untuk ${request.requesterName}${request.department ? " (" + request.department + ")" : ""}`,
          amount: request.qty * request.unitPrice,
          type: "keluar",
        },
      });
      transactionId = transaction.id;
    }

    await tx.inventoryRequest.update({
      where: { id },
      data: { status: "selesai", completedAt: new Date(), transactionId },
    });
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryRequest.complete", entity: "InventoryRequest", entityId: id, detail: request.itemName },
  });

  revalidatePath("/gudang");
  revalidatePath("/kas");
  revalidatePath("/");
}

// Cancelling a "berjalan" request is a no-op on stock/Kas (nothing was
// posted yet). Cancelling a "selesai" one reverses both: restores stock
// (if trackStock) and posts a reversing Kas entry — same
// cancel-with-reversing-entry pattern as cancelInvoiceBj/cancelInvoice.
export async function cancelInventoryRequest(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const request = await db.inventoryRequest.findUnique({ where: { id }, include: { item: true } });
  if (!request) return;
  if (request.status === "dibatalkan") throw new Error("Pengambilan ini sudah dibatalkan sebelumnya.");

  const wasCompleted = request.status === "selesai";
  const account = await db.account.findFirst({ where: { code: "5011" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });

  await db.$transaction(async (tx) => {
    if (wasCompleted && request.item.trackStock) {
      await tx.inventoryItem.update({ where: { id: request.itemId }, data: { qty: { increment: request.qty } } });
    }

    // Only reverse if this request actually posted a Transaction —
    // otherwise there's nothing in Kas to correct.
    if (wasCompleted && request.transactionId && account && cashAccount) {
      await tx.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: `Pembatalan pengambilan barang — ${request.itemName} ${request.qty} ${request.item.unit} (${request.requesterName})`,
          amount: request.qty * request.unitPrice,
          type: "masuk",
        },
      });
    }

    await tx.inventoryRequest.update({ where: { id }, data: { status: "dibatalkan", cancelledAt: new Date() } });
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryRequest.cancel", entity: "InventoryRequest", entityId: id, detail: request.itemName },
  });

  revalidatePath("/gudang");
  revalidatePath("/kas");
  revalidatePath("/");
}
