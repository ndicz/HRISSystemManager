"use client";

import { useState } from "react";
import { updateLeaveRequest, deleteLeaveRequest } from "@/app/(app)/cuti/actions";

type LeaveRow = { id: string; employeeName: string; type: string; startDate: Date; endDate: Date; reason: string };

function toDateInputValue(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function EditLeaveRequestDialog({ request }: { request: LeaveRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateLeaveRequest(request.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus pengajuan cuti "${request.employeeName}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteLeaveRequest(request.id)
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
            <div className="dialog-title">Edit pengajuan cuti &mdash; {request.employeeName}</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-leave-type">Jenis cuti</label>
                <select className="input" id="edit-leave-type" name="type" defaultValue={request.type}>
                  <option>Cuti Tahunan</option>
                  <option>Sakit</option>
                  <option>Melahirkan</option>
                  <option>Lainnya</option>
                </select>
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="edit-leave-start">Mulai</label>
                  <input className="input" id="edit-leave-start" name="startDate" type="date" required defaultValue={toDateInputValue(request.startDate)} />
                </div>
                <div className="field">
                  <label htmlFor="edit-leave-end">Selesai</label>
                  <input className="input" id="edit-leave-end" name="endDate" type="date" required defaultValue={toDateInputValue(request.endDate)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-leave-reason">Alasan</label>
                <input className="input" id="edit-leave-reason" name="reason" defaultValue={request.reason} />
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
