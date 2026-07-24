"use client";

import { useState } from "react";
import { updateAssignment, deleteAssignment } from "@/app/(app)/karyawan/actions";
import { RupiahInput } from "@/components/RupiahInput";

type AssignmentRow = { id: string; employeeName: string; title: string; mandays: number; cost: number; period: string | null };

export function EditAssignmentDialog({ assignment }: { assignment: AssignmentRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateAssignment(assignment.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus penugasan "${assignment.title}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteAssignment(assignment.id)
      .then(() => setOpen(false))
      .catch((err) => setDelError(err instanceof Error ? err.message : String(err)))
      .finally(() => setDelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit penugasan &mdash; {assignment.employeeName}</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-assign-title">Judul penugasan</label>
                <input className="input" id="edit-assign-title" name="title" required defaultValue={assignment.title} />
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="edit-assign-mandays">Mandays</label>
                  <input className="input" id="edit-assign-mandays" name="mandays" type="number" min={0} defaultValue={assignment.mandays} />
                </div>
                <div className="field">
                  <label htmlFor="edit-assign-cost">Biaya (Rp)</label>
                  <RupiahInput id="edit-assign-cost" name="cost" defaultValue={assignment.cost} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-assign-period">Periode payslip (opsional, YYYY-MM)</label>
                <input className="input" id="edit-assign-period" name="period" defaultValue={assignment.period ?? ""} placeholder="mis. 2026-07" />
              </div>
              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              {delError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{delError}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" disabled={delPending} onClick={handleDelete} style={{ marginRight: "auto" }}>
                  {delPending ? "Menghapus…" : "Hapus"}
                </button>
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
