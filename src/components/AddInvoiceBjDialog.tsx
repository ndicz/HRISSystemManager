"use client";

import { useState, useRef } from "react";
import { addInvoiceBj } from "@/app/(app)/klien/actions";

type Option = { id: string; name: string };

export function AddInvoiceBjDialog({ clients }: { clients: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addInvoiceBj(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Buat invoice baru</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Buat invoice barang &amp; jasa</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="clientId">Klien</label>
                <select className="input" id="clientId" name="clientId" required>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row" }}>
                <input type="checkbox" name="withPpn" defaultChecked style={{ width: "auto" }} />
                <span>Kena PPN 11%</span>
              </label>
              <div className="field" style={{ marginBottom: 0 }}><label>Item</label></div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="grid-cols" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "var(--space-2)" }}>
                  <input className="input" name={`desc${i}`} placeholder={i === 1 ? "Nama item/jasa" : `Item ke-${i} (opsional)`} />
                  <input className="input" name={`qty${i}`} type="number" placeholder="Qty" />
                  <input className="input" name={`price${i}`} type="number" placeholder="Harga satuan" />
                </div>
              ))}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Buat invoice"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
