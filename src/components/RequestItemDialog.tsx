"use client";

import { useState, useRef, useMemo } from "react";
import { requestItem } from "@/app/(app)/gudang/actions";
import { formatRp } from "@/lib/payroll";

type ItemOption = { id: string; name: string; unit: string; qty: number; price: number };

export function RequestItemDialog({ items }: { items: ItemOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const selected = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const total = selected ? selected.price * qty : 0;

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await requestItem(formData);
      setOpen(false);
      formRef.current?.reset();
      setItemId("");
      setQty(1);
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} disabled={items.length === 0}>
        Ambil barang
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Ambil barang gudang</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="req-itemId">Barang</label>
                <select className="input" id="req-itemId" name="itemId" required value={itemId} onChange={(e) => { setItemId(e.target.value); setError(""); }}>
                  <option value="">Pilih barang…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id} disabled={i.qty === 0}>
                      {i.name} — sisa {i.qty} {i.unit} {i.qty === 0 ? "(habis)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="req-qty">Jumlah</label>
                  <input
                    className="input"
                    id="req-qty"
                    name="qty"
                    type="number"
                    min={1}
                    max={selected?.qty ?? undefined}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Harga satuan</label>
                  <div className="input" style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>{selected ? formatRp(selected.price) : "-"}</div>
                </div>
              </div>
              {selected && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Total nilai barang: <strong>{formatRp(total)}</strong> — akan otomatis tercatat sebagai pengeluaran di Kas.
                </p>
              )}
              <div className="field">
                <label htmlFor="req-requesterName">Nama peminta</label>
                <input className="input" id="req-requesterName" name="requesterName" required placeholder="Nama karyawan/pemohon" />
              </div>
              <div className="field">
                <label htmlFor="req-department">Tempat kerja/departemen (opsional)</label>
                <input className="input" id="req-department" name="department" placeholder="mis. RS Borromeus" />
              </div>
              <div className="field">
                <label htmlFor="req-note">Keterangan (opsional)</label>
                <input className="input" id="req-note" name="note" placeholder="mis. Untuk ruang admin baru" />
              </div>
              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending || !itemId}>{pending ? "Memproses…" : "Ambil barang"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
