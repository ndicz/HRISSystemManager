"use client";

import { useState } from "react";
import { updateSite, deleteSite } from "@/app/(app)/karyawan/actions";
import { formatActionError } from "@/lib/errors";
import { RupiahInput } from "@/components/RupiahInput";

type SiteRow = {
  id: string; name: string; address: string; supervisor: string; umr: number;
  bpjsKesehatanOverride: number | null; bpjsKetenagakerjaanOverride: number | null;
};

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
      setError(formatActionError(err));
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
      .catch((err) => setDelError(formatActionError(err)))
      .finally(() => setDelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
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
                <RupiahInput id="edit-site-umr" name="umr" defaultValue={site.umr} />
              </div>
              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Override BPJS untuk semua karyawan di tempat kerja ini</div>
                <p style={{ fontSize: 12, opacity: 0.6, margin: "0 0 var(--space-3)" }}>
                  Kosongkan = pakai rumus otomatis. Override manual per karyawan (di halaman Penggajian) tetap menang
                  atas ini kalau ada.
                </p>
                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="edit-site-bpjs-kes">BPJS Kesehatan (Rp)</label>
                    <RupiahInput id="edit-site-bpjs-kes" name="bpjsKesehatanOverride" placeholder="Otomatis" defaultValue={site.bpjsKesehatanOverride} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="edit-site-bpjs-tk">BPJS Ketenagakerjaan (Rp)</label>
                    <RupiahInput id="edit-site-bpjs-tk" name="bpjsKetenagakerjaanOverride" placeholder="Otomatis" defaultValue={site.bpjsKetenagakerjaanOverride} />
                  </div>
                </div>
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              {delError && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{delError}</p>}
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
