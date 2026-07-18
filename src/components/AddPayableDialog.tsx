"use client";

import { useState, useRef } from "react";
import { addPayable } from "@/app/(app)/kas/actions";

export function AddPayableDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addPayable(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Catat hutang</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Catat hutang usaha</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="vendorName">Nama vendor</label>
                <input className="input" id="vendorName" name="vendorName" required placeholder="Nama perusahaan/supplier" />
              </div>
              <div className="field">
                <label htmlFor="desc">Keterangan</label>
                <input className="input" id="desc" name="desc" placeholder="Keterangan tagihan" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="amount">Jumlah (Rp)</label>
                  <input className="input" id="amount" name="amount" type="number" required placeholder="0" />
                </div>
                <div className="field">
                  <label htmlFor="dueDate">Jatuh tempo</label>
                  <input className="input" id="dueDate" name="dueDate" type="date" required />
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
