"use client";

import { useState } from "react";
import { updateSite, deleteSite } from "@/app/(app)/karyawan/actions";

type SiteRow = { id: string; name: string; address: string; supervisor: string; umr: number };

export function EditSiteDialog({ site }: { site: SiteRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateSite(site.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus tempat kerja "${site.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteSite(site.id)
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
            <div className="dialog-title">Edit tempat kerja</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-site-name">Nama lokasi</label>
                <input className="input" id="edit-site-name" name="name" required defaultValue={site.name} />
              </div>
              <div className="field">
                <label htmlFor="edit-site-address">Alamat</label>
                <input className="input" id="edit-site-address" name="address" defaultValue={site.address} />
              </div>
              <div className="field">
                <label htmlFor="edit-site-supervisor">Penanggung jawab</label>
                <input className="input" id="edit-site-supervisor" name="supervisor" defaultValue={site.supervisor} />
              </div>
              <div className="field">
                <label htmlFor="edit-site-umr">UMR/UMK (Rp)</label>
                <input className="input" id="edit-site-umr" name="umr" type="number" min={0} defaultValue={site.umr} />
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
