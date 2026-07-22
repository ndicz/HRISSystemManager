"use client";

import { useState, useRef } from "react";
import { updatePosition } from "@/app/(app)/karyawan/actions";

type Position = { id: string; name: string; salaryType: string; baseSalary: number };

export function EditPositionDialog({ position }: { position: Position }) {
  const [open, setOpen] = useState(false);
  const [salaryType, setSalaryType] = useState(position.salaryType);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updatePosition(formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit posisi</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <input type="hidden" name="positionId" value={position.id} />
              <div className="field">
                <label htmlFor="edit-pos-name">Nama posisi</label>
                <input className="input" id="edit-pos-name" name="name" required defaultValue={position.name} />
              </div>
              <div className="field">
                <label>Jenis gaji</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt">
                    <input type="radio" name="salaryType" value="bulanan" checked={salaryType === "bulanan"} onChange={() => setSalaryType("bulanan")} />
                    Bulanan
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="salaryType" value="harian" checked={salaryType === "harian"} onChange={() => setSalaryType("harian")} />
                    Harian
                  </label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-pos-salary">Gaji pokok default (Rp)</label>
                <input className="input" id="edit-pos-salary" name="baseSalary" type="number" min={0} defaultValue={position.baseSalary} />
              </div>
              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
