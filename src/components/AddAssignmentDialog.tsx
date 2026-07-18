"use client";

import { useState, useRef } from "react";
import { addAssignment } from "@/app/(app)/karyawan/actions";

type Option = { id: string; name: string };

export function AddAssignmentDialog({ employees }: { employees: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addAssignment(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Ajukan penugasan
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Ajukan penugasan tambahan</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="assign-employeeId">Karyawan</label>
                <select className="input" id="assign-employeeId" name="employeeId" required>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="assign-title">Judul penugasan</label>
                <input className="input" id="assign-title" name="title" required placeholder="mis. Lembur proyek klien X" />
              </div>
              <div className="field">
                <label htmlFor="assign-mandays">Estimasi hari (mandays)</label>
                <input className="input" id="assign-mandays" name="mandays" type="number" min={0} placeholder="0" />
              </div>
              <div className="field">
                <label htmlFor="assign-cost">Biaya (Rp)</label>
                <input className="input" id="assign-cost" name="cost" type="number" min={0} placeholder="0" />
              </div>
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
