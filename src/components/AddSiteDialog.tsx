"use client";

import { useState, useRef } from "react";
import { addSite } from "@/app/(app)/karyawan/actions";

export function AddSiteDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addSite(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Tambah tempat kerja
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah tempat kerja</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="site-name">Nama lokasi</label>
                <input className="input" id="site-name" name="name" required placeholder="mis. Gudang Cibitung" />
              </div>
              <div className="field">
                <label htmlFor="site-address">Alamat</label>
                <input className="input" id="site-address" name="address" placeholder="Alamat lengkap" />
              </div>
              <div className="field">
                <label htmlFor="site-supervisor">Penanggung jawab</label>
                <input className="input" id="site-supervisor" name="supervisor" placeholder="Nama supervisor" />
              </div>
              <div className="field">
                <label htmlFor="site-umr">UMR/UMK wilayah (Rp)</label>
                <input className="input" id="site-umr" name="umr" type="number" min={0} placeholder="mis. 4500000" />
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
