"use client";

import { useState } from "react";
import { updateInventoryItem, deleteInventoryItem, restockItem } from "@/app/(app)/gudang/actions";
import { RupiahInput } from "@/components/RupiahInput";
import { formatRp } from "@/lib/payroll";

type ItemRow = { id: string; name: string; unit: string; qty: number; price: number; category: string | null; trackStock: boolean; purpose: string };

export function EditInventoryItemDialog({ item }: { item: ItemRow }) {
  const [open, setOpen] = useState(false);
  const [trackStock, setTrackStock] = useState(item.trackStock);
  const [purpose, setPurpose] = useState<"stock" | "mbp">(item.purpose === "mbp" ? "mbp" : "stock");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);
  const [restockError, setRestockError] = useState("");
  const [restockPending, setRestockPending] = useState(false);
  const [addQty, setAddQty] = useState("");

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateInventoryItem(item.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus barang "${item.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteInventoryItem(item.id)
      .then(() => setOpen(false))
      .catch((err) => setDelError(err instanceof Error ? err.message : String(err)))
      .finally(() => setDelPending(false));
  }

  function handleRestock() {
    setRestockError("");
    setRestockPending(true);
    const fd = new FormData();
    fd.set("addQty", addQty);
    restockItem(item.id, fd)
      .then(() => setAddQty(""))
      .catch((err) => setRestockError(err instanceof Error ? err.message : String(err)))
      .finally(() => setRestockPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit barang &mdash; {item.name}</div>

            {item.trackStock && (
              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", marginBottom: "var(--space-3)" }}>
                <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Tambah stok (stok sekarang: {item.qty} {item.unit})</div>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="restock-qty">Jumlah tambahan</label>
                    <input className="input" id="restock-qty" type="number" min={1} value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder="0" />
                  </div>
                  <button type="button" className="btn btn-secondary" disabled={restockPending || !addQty} onClick={handleRestock}>
                    {restockPending ? "Menyimpan…" : "Tambah stok"}
                  </button>
                </div>
                {restockError && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: "8px 0 0" }}>{restockError}</p>}
              </div>
            )}

            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-inv-name">Nama barang</label>
                <input className="input" id="edit-inv-name" name="name" required defaultValue={item.name} />
              </div>
              <div className="field">
                <label>Jenis barang</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt">
                    <input type="radio" name="trackStock" value="on" checked={trackStock} onChange={() => setTrackStock(true)} /> Stok fisik
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="trackStock" value="off" checked={!trackStock} onChange={() => setTrackStock(false)} /> Beli sesuai permintaan
                  </label>
                </div>
                {item.trackStock && !trackStock && (
                  <p style={{ fontSize: 12, color: "var(--color-danger)", margin: "4px 0 0" }}>
                    Stok saat ini ({item.qty} {item.unit}) akan direset ke 0 kalau disimpan sebagai &ldquo;Beli sesuai permintaan&rdquo;.
                  </p>
                )}
              </div>
              <div className="field">
                <label>Untuk keperluan</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt">
                    <input type="radio" name="purpose" value="stock" checked={purpose === "stock"} onChange={() => setPurpose("stock")} /> Stok internal
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="purpose" value="mbp" checked={purpose === "mbp"} onChange={() => setPurpose("mbp")} /> Barang MBP
                  </label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-inv-category">Kategori</label>
                <input className="input" id="edit-inv-category" name="category" defaultValue={item.category ?? ""} />
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="edit-inv-unit">Satuan</label>
                  <input className="input" id="edit-inv-unit" name="unit" defaultValue={item.unit} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="edit-inv-price">Harga satuan (Rp)</label>
                  <RupiahInput id="edit-inv-price" name="price" defaultValue={item.price} />
                </div>
              </div>
              {item.trackStock && <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Nilai stok saat ini: {formatRp(item.qty * item.price)}</p>}
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              {delError && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{delError}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" disabled={delPending} onClick={handleDelete} style={{ marginRight: "auto" }}>
                  {delPending ? "Menghapus…" : "Hapus"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
