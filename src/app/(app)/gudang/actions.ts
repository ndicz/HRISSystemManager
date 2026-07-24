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
  if (!name) throw new Error("Nama barang wajib diisi.");

  const item = await db.inventoryItem.create({ data: { name, unit, qty, price, category, trackStock } });

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
  if (!name) throw new Error("Nama barang wajib diisi.");

  // Switching a physically-tracked item to "beli sesuai permintaan" resets
  // its qty to 0 — the number stops meaning anything once stock isn't
  // deducted per request anymore, so leaving a stale count around would
  // just be confusing on the item list.
  await db.inventoryItem.update({
    where: { id },
    data: { name, unit, price, category, trackStock, ...(trackStock ? {} : { qty: 0 }) },
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

// Someone takes an item out of the warehouse (mis. AC 1 PK untuk kantor
// baru) — deducts stock, records who took it (for the printable bukti),
// and posts a Kas expense for the item's value, same pattern as
// completeAssignment/bayarGaji/payPayable elsewhere in this app.
export async function requestItem(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const itemId = String(formData.get("itemId") ?? "");
  const qty = Math.max(1, parseInt(String(formData.get("qty") ?? "1"), 10) || 1);
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!itemId || !requesterName) throw new Error("Barang dan nama peminta wajib diisi.");

  const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Barang tidak ditemukan.");
  if (!item.active) throw new Error(`Barang "${item.name}" sedang nonaktif dan tidak bisa diambil.`);
  if (item.trackStock && qty > item.qty) throw new Error(`Stok tidak cukup — sisa stok ${item.name} hanya ${item.qty} ${item.unit}.`);

  const account = await db.account.findFirst({ where: { code: "5011" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });

  const request = await db.$transaction(async (tx) => {
    // Barang "beli sesuai permintaan" tidak punya stok untuk dikurangi —
    // setiap pengambilan dianggap pembelian baru, bukan mengurangi
    // persediaan yang sudah ada.
    if (item.trackStock) {
      await tx.inventoryItem.update({ where: { id: itemId }, data: { qty: { decrement: qty } } });
    }

    let transactionId: string | null = null;
    if (account && cashAccount) {
      const transaction = await tx.transaction.create({
        data: {
          date: new Date(),
          accountCoaId: account.id,
          cashAccountId: cashAccount.id,
          desc: `Pengeluaran barang — ${item.name} ${qty} ${item.unit} untuk ${requesterName}${department ? " (" + department + ")" : ""}`,
          amount: item.price * qty,
          type: "keluar",
        },
      });
      transactionId = transaction.id;
    }

    return tx.inventoryRequest.create({
      data: {
        itemId,
        itemName: item.name,
        qty,
        unitPrice: item.price,
        requesterName,
        department,
        note,
        transactionId,
        createdById: session.user.id,
      },
    });
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryRequest.create", entity: "InventoryRequest", entityId: request.id, detail: JSON.stringify({ item: item.name, qty, requesterName }) },
  });

  revalidatePath("/gudang");
  revalidatePath("/kas");
  revalidatePath("/");
}

// Cancels a fulfilled request: restores stock (if the item is trackStock)
// and posts a reversing Kas entry for the original amount — same
// cancel-with-reversing-entry pattern as cancelInvoiceBj/cancelInvoice,
// rather than deleting the request or the original Transaction outright,
// so the audit trail (what was taken, then reversed, and when) stays
// intact.
export async function cancelInventoryRequest(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const request = await db.inventoryRequest.findUnique({ where: { id }, include: { item: true } });
  if (!request) return;
  if (request.cancelledAt) throw new Error("Pengambilan ini sudah dibatalkan sebelumnya.");

  const account = await db.account.findFirst({ where: { code: "5011" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });

  await db.$transaction(async (tx) => {
    if (request.item.trackStock) {
      await tx.inventoryItem.update({ where: { id: request.itemId }, data: { qty: { increment: request.qty } } });
    }

    // Only reverse if the original request actually posted a Transaction —
    // otherwise there's nothing in Kas to correct.
    if (request.transactionId && account && cashAccount) {
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

    await tx.inventoryRequest.update({ where: { id }, data: { cancelledAt: new Date() } });
  });

  await db.auditLog.create({
    data: { userId: session.user.id, action: "inventoryRequest.cancel", entity: "InventoryRequest", entityId: id, detail: request.itemName },
  });

  revalidatePath("/gudang");
  revalidatePath("/kas");
  revalidatePath("/");
}
