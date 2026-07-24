"use client";

import { useState } from "react";
import { updateClient, deleteClient } from "@/app/(app)/klien/actions";

type ClientRow = {
  id: string;
  name: string;
  pic: string;
  picPhone: string | null;
  address: string | null;
  feeType: string;
  feeValue: number;
};

export function EditClientDialog({ client }: { client: ClientRow }) {
  const [open, setOpen] = useState(false);
  const [feeType, setFeeType] = useState(client.feeType);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateClient(client.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus klien "${client.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteClient(client.id)
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
            <div className="dialog-title">Edit klien</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-client-name">Nama klien</label>
                <input className="input" id="edit-client-name" name="name" required defaultValue={client.name} />
              </div>
              <div className="field">
                <label htmlFor="edit-client-pic">PIC</label>
                <input className="input" id="edit-client-pic" name="pic" defaultValue={client.pic} placeholder="Nama penanggung jawab" />
              </div>
              <div className="field">
                <label htmlFor="edit-client-picPhone">Telepon PIC</label>
                <input className="input" id="edit-client-picPhone" name="picPhone" defaultValue={client.picPhone ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="edit-client-address">Alamat</label>
                <input className="input" id="edit-client-address" name="address" defaultValue={client.address ?? ""} />
              </div>
              <div className="field">
                <label>Skema fee</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt"><input type="radio" name="feeType" value="percent" checked={feeType === "percent"} onChange={() => setFeeType("percent")} /> % dari gaji</label>
                  <label className="seg-opt"><input type="radio" name="feeType" value="flat" checked={feeType === "flat"} onChange={() => setFeeType("flat")} /> Flat/karyawan</label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-client-feeValue">Nilai fee</label>
                <input className="input" id="edit-client-feeValue" name="feeValue" type="number" min={0} defaultValue={client.feeValue} />
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
