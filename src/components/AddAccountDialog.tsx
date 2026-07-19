"use client";

import { useState, useRef } from "react";
import { addAccount } from "@/app/(app)/kas/actions";

export function AddAccountDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addAccount(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>+ Akun baru</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah akun (COA)</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="code">Kode</label>
                  <input className="input" id="code" name="code" required placeholder="5010" />
                </div>
                <div className="field">
                  <label htmlFor="name">Nama akun</label>
                  <input className="input" id="name" name="name" required placeholder="Nama akun baru" />
                </div>
              </div>
              <div className="field">
                <label>Tipe</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt"><input type="radio" name="type" value="keluar" defaultChecked /> Beban</label>
                  <label className="seg-opt"><input type="radio" name="type" value="masuk" /> Pendapatan</label>
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
