"use client";

import { useState, useRef } from "react";
import { addEmployee } from "@/app/(app)/karyawan/actions";

type Option = { id: string; name: string };

export function AddEmployeeDialog({
  sites,
  positions,
  clients,
}: {
  sites: Option[];
  positions: Option[];
  clients: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [contractType, setContractType] = useState("PKWT");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addEmployee(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Tambah karyawan
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah karyawan</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="name">Nama</label>
                <input className="input" id="name" name="name" required placeholder="Nama lengkap" />
              </div>
              <div className="field">
                <label htmlFor="siteId">Tempat kerja</label>
                <select className="input" id="siteId" name="siteId" required>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="positionId">Posisi</label>
                <select className="input" id="positionId" name="positionId" required>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="clientId">Klien</label>
                <select className="input" id="clientId" name="clientId">
                  <option value="">Internal · tanpa klien</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Jenis kontrak</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="contractType"
                      value="PKWT"
                      checked={contractType === "PKWT"}
                      onChange={() => setContractType("PKWT")}
                    />
                    PKWT
                  </label>
                  <label className="seg-opt">
                    <input
                      type="radio"
                      name="contractType"
                      value="PKWTT"
                      checked={contractType === "PKWTT"}
                      onChange={() => setContractType("PKWTT")}
                    />
                    PKWTT
                  </label>
                </div>
              </div>
              {contractType === "PKWT" && (
                <div className="field">
                  <label htmlFor="contractEnd">Kontrak berakhir</label>
                  <input className="input" id="contractEnd" name="contractEnd" type="date" />
                </div>
              )}
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
