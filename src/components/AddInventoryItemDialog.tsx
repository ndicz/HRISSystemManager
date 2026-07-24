"use client";

import { useState, useRef } from "react";
import { addInventoryItem } from "@/app/(app)/gudang/actions";
import { RupiahInput } from "@/components/RupiahInput";

export function AddInventoryItemDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [trackStock, setTrackStock] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addInventoryItem(formData);
      setOpen(false);
      formRef.current?.reset();
      setTrackStock(true);
      setFormKey((k) => k + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Tambah barang</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah barang gudang</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="inv-name">Nama barang</label>
                <input className="input" id="inv-name" name="name" required placeholder="mis. AC 1 PK" />
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
                <p style={{ fontSize: 12, opacity: 0.6, margin: "4px 0 0" }}>
                  {trackStock
                    ? "Stok dikurangi tiap kali barang ini diambil, dan dihitung ke Total Nilai Stok."
                    : "Tidak ada batas stok — barang ini selalu bisa diambil (mis. barang yang dibeli baru tiap dibutuhkan), dan tidak dihitung ke Total Nilai Stok."}
                </p>
              </div>
              <div className="field">
                <label htmlFor="inv-category">Kategori (opsional)</label>
                <input className="input" id="inv-category" name="category" placeholder="mis. Elektronik" />
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: trackStock ? "1fr 1fr 1fr" : "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="inv-unit">Satuan</label>
                  <input className="input" id="inv-unit" name="unit" defaultValue="unit" placeholder="unit/pcs/set" />
                </div>
                {trackStock && (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="inv-qty">Stok awal</label>
                    <input className="input" id="inv-qty" name="qty" type="number" min={0} placeholder="0" />
                  </div>
                )}
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="inv-price">Harga satuan (Rp)</label>
                  <RupiahInput id="inv-price" name="price" placeholder="0" />
                </div>
              </div>
              <div className="dialog-actions">
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
