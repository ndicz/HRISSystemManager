"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addInventoryItem(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || "unit";
  const qty = Math.max(0, parseInt(String(formData.get("qty") ?? "0"), 10) || 0);
  const price = Math.max(0, parseInt(String(formData.get("price") ?? "0"), 10) || 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  if (!name) throw new Error("Nama barang wajib diisi.");

  const item = await db.inventoryItem.create({ data: { name, unit, qty, price, category } });

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
  const price = Math.max(0, parseInt(String(formData.get("price") ?? "0"), 10) || 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  if (!name) throw new Error("Nama barang wajib diisi.");

  await db.inventoryItem.update({ where: { id }, data: { name, unit, price, category } });

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

// Adds to stock (barang masuk/pembelian baru) — separate from
// updateInventoryItem so editing the item's name/category can't
// accidentally also change the stock count.
export async function restockItem(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

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
  if (qty > item.qty) throw new Error(`Stok tidak cukup — sisa stok ${item.name} hanya ${item.qty} ${item.unit}.`);

  const account = await db.account.findFirst({ where: { code: "5011" } });
  const cashAccount = await db.cashAccount.findFirst({ where: { kind: "besar" } });

  const request = await db.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id: itemId }, data: { qty: { decrement: qty } } });

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
