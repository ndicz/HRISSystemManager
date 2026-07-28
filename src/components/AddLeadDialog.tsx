"use client";

import { useState, useRef } from "react";
import { addLead } from "@/app/(app)/crm/actions";
import { RupiahInput } from "@/components/RupiahInput";

export function AddLeadDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await addLead(formData);
      setOpen(false);
      formRef.current?.reset();
      setFormKey((k) => k + 1);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Prospek baru</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Prospek baru</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="lead-companyName">Nama perusahaan</label>
                <input className="input" id="lead-companyName" name="companyName" required placeholder="mis. RS Contoh Sehat" />
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="lead-picName">Nama PIC</label>
                  <input className="input" id="lead-picName" name="picName" placeholder="mis. Budi Santoso" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="lead-picPhone">Telepon PIC</label>
                  <input className="input" id="lead-picPhone" name="picPhone" placeholder="08xx..." />
                </div>
              </div>
              <div className="field">
                <label htmlFor="lead-picEmail">Email PIC (opsional)</label>
                <input className="input" id="lead-picEmail" name="picEmail" type="email" placeholder="nama@perusahaan.com" />
              </div>
              <div className="field">
                <label htmlFor="lead-address">Alamat (opsional)</label>
                <input className="input" id="lead-address" name="address" placeholder="Alamat perusahaan" />
              </div>
              <div className="field">
                <label htmlFor="lead-estimatedValue">Estimasi nilai deal (Rp)</label>
                <RupiahInput id="lead-estimatedValue" name="estimatedValue" placeholder="0" />
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
