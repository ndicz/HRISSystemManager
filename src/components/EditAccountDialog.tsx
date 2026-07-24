"use client";

import { useState } from "react";
import { updateAccount, deleteAccount } from "@/app/(app)/kas/actions";

type AccountRow = { id: string; code: string; name: string; type: string };

export function EditAccountDialog({ account }: { account: AccountRow }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(account.type);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateAccount(account.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus akun "${account.code} · ${account.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteAccount(account.id)
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
            <div className="dialog-title">Edit akun {account.code}</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-acc-name">Nama akun</label>
                <input className="input" id="edit-acc-name" name="name" required defaultValue={account.name} />
              </div>
              <div className="field">
                <label>Kategori</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt"><input type="radio" name="type" value="masuk" checked={type === "masuk"} onChange={() => setType("masuk")} /> Pendapatan</label>
                  <label className="seg-opt"><input type="radio" name="type" value="keluar" checked={type === "keluar"} onChange={() => setType("keluar")} /> Beban</label>
                </div>
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
