"use client";

import { useState, useRef } from "react";
import { addClient } from "@/app/(app)/klien/actions";
import { RupiahInput } from "@/components/RupiahInput";
import { formatActionError } from "@/lib/errors";
import { submitForm } from "@/lib/submitForm";

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [feeType, setFeeType] = useState("percent");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await addClient(formData);
      setOpen(false);
      setFeeType("percent");
      formRef.current?.reset();
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Tambah klien</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah klien</div>
            <form ref={formRef} onSubmit={(e) => submitForm(e, handleSubmit)} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="name">Nama klien</label>
                <input className="input" id="name" name="name" required placeholder="Nama perusahaan klien" />
              </div>
              <div className="field">
                <label htmlFor="pic">PIC</label>
                <input className="input" id="pic" name="pic" placeholder="Nama penanggung jawab" />
              </div>
              <div className="field">
                <label>Skema fee</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt"><input type="radio" name="feeType" value="percent" checked={feeType === "percent"} onChange={() => setFeeType("percent")} /> % dari gaji</label>
                  <label className="seg-opt"><input type="radio" name="feeType" value="flat" checked={feeType === "flat"} onChange={() => setFeeType("flat")} /> Flat/karyawan</label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="feeValue">Nilai fee</label>
                {feeType === "flat" ? (
                  <RupiahInput id="feeValue" name="feeValue" placeholder="0" />
                ) : (
                  <input className="input" id="feeValue" name="feeValue" type="number" placeholder="0" />
                )}
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
