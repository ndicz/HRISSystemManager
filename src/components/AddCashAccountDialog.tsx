"use client";

import { useState, useRef } from "react";
import { createCashAccount } from "@/app/(app)/kas/actions";
import { RupiahInput } from "@/components/RupiahInput";

export function AddCashAccountDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await createCashAccount(formData);
      setOpen(false);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>+ Rekening baru</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah rekening</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="cashacc-name">Nama rekening</label>
                <input className="input" id="cashacc-name" name="name" required placeholder="mis. BCA Operasional, Kas Kecil Kantor" />
              </div>
              <div className="field">
                <label>Jenis</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt"><input type="radio" name="kind" value="besar" defaultChecked /> Kas besar (rekening bank)</label>
                  <label className="seg-opt"><input type="radio" name="kind" value="kecil" /> Kas kecil (petty cash)</label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="cashacc-opening">Saldo awal (opsional)</label>
                <RupiahInput id="cashacc-opening" name="opening" defaultValue={0} placeholder="0" />
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
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
