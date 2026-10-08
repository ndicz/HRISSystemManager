"use client";

import { useState, useRef } from "react";
import { addPayable } from "@/app/(app)/kas/actions";
import { RupiahInput } from "@/components/RupiahInput";
import { formatActionError } from "@/lib/errors";
import { submitForm } from "@/lib/submitForm";

export function AddPayableDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await addPayable(formData);
      setOpen(false);
      formRef.current?.reset();
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(formatActionError(err));
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
            <form key={formKey} ref={formRef} onSubmit={(e) => submitForm(e, handleSubmit)} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="vendorName">Nama vendor</label>
                <input className="input" id="vendorName" name="vendorName" required placeholder="Nama perusahaan/supplier" />
              </div>
              <div className="field">
                <label htmlFor="desc">Keterangan</label>
                <input className="input" id="desc" name="desc" placeholder="Keterangan tagihan" />
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="amount">Jumlah (Rp)</label>
                  <RupiahInput id="amount" name="amount" placeholder="0" />
                </div>
                <div className="field">
                  <label htmlFor="dueDate">Jatuh tempo</label>
                  <input className="input" id="dueDate" name="dueDate" type="date" required />
                </div>
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
