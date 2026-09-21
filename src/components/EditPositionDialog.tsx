"use client";

import { useState, useRef } from "react";
import { updatePosition, deletePosition } from "@/app/(app)/karyawan/actions";
import { formatActionError } from "@/lib/errors";
import { RupiahInput } from "@/components/RupiahInput";

type Position = {
  id: string; name: string; salaryType: string; baseSalary: number;
  bpjsKesehatanOverride: number | null; bpjsKetenagakerjaanOverride: number | null;
};

export function EditPositionDialog({ position }: { position: Position }) {
  const [open, setOpen] = useState(false);
  const [salaryType, setSalaryType] = useState(position.salaryType);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updatePosition(formData);
      setOpen(false);
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus posisi "${position.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deletePosition(position.id)
      .then(() => setOpen(false))
      .catch((err) => setDelError(formatActionError(err)))
      .finally(() => setDelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
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
                <RupiahInput id="edit-pos-salary" name="baseSalary" defaultValue={position.baseSalary} />
              </div>
              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Override BPJS untuk semua karyawan di posisi ini</div>
                <p style={{ fontSize: 12, opacity: 0.6, margin: "0 0 var(--space-3)" }}>
                  Kosongkan = pakai rumus otomatis. Override tempat kerja dan override personal karyawan (di halaman
                  Karyawan/Penggajian) tetap menang atas ini kalau ada.
                </p>
                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="edit-pos-bpjs-kes">BPJS Kesehatan (Rp)</label>
                    <RupiahInput id="edit-pos-bpjs-kes" name="bpjsKesehatanOverride" placeholder="Otomatis" defaultValue={position.bpjsKesehatanOverride} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="edit-pos-bpjs-tk">BPJS Ketenagakerjaan (Rp)</label>
                    <RupiahInput id="edit-pos-bpjs-tk" name="bpjsKetenagakerjaanOverride" placeholder="Otomatis" defaultValue={position.bpjsKetenagakerjaanOverride} />
                  </div>
                </div>
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              {delError && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{delError}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" disabled={delPending} onClick={handleDelete} style={{ marginRight: "auto" }}>
                  {delPending ? "Menghapus…" : "Hapus"}
                </button>
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
