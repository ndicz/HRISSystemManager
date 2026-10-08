"use client";

import { useState, useRef } from "react";
import { addCandidate } from "@/app/(app)/rekrutmen/actions";
import { formatActionError } from "@/lib/errors";
import { submitForm } from "@/lib/submitForm";

type Option = { id: string; name: string };

export function AddCandidateDialog({ positions }: { positions: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await addCandidate(formData);
      setOpen(false);
      formRef.current?.reset();
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Tambah kandidat</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah kandidat</div>
            <form ref={formRef} onSubmit={(e) => submitForm(e, handleSubmit)} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="name">Nama</label>
                <input className="input" id="name" name="name" required placeholder="Nama lengkap" />
              </div>
              <div className="field">
                <label htmlFor="position">Posisi dilamar</label>
                <select className="input" id="position" name="position" required>
                  {positions.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
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
