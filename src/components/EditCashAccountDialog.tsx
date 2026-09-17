"use client";

import { useState } from "react";
import { updateCashAccount, deleteCashAccount } from "@/app/(app)/kas/actions";
import { RupiahInput } from "@/components/RupiahInput";
import { formatActionError } from "@/lib/errors";

type CashAccountRow = { id: string; name: string; kind: string; opening: number };

export function EditCashAccountDialog({ cashAccount }: { cashAccount: CashAccountRow }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(cashAccount.kind);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateCashAccount(cashAccount.id, formData);
      setOpen(false);
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus rekening "${cashAccount.name}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteCashAccount(cashAccount.id)
      .then(() => setOpen(false))
      .catch((err) => setDelError(formatActionError(err)))
      .finally(() => setDelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit rekening</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="edit-cashacc-name">Nama rekening</label>
                <input className="input" id="edit-cashacc-name" name="name" required defaultValue={cashAccount.name} />
              </div>
              <div className="field">
                <label>Jenis</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt"><input type="radio" name="kind" value="besar" checked={kind === "besar"} onChange={() => setKind("besar")} /> Kas besar (rekening bank)</label>
                  <label className="seg-opt"><input type="radio" name="kind" value="kecil" checked={kind === "kecil"} onChange={() => setKind("kecil")} /> Kas kecil (petty cash)</label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-cashacc-opening">Saldo awal</label>
                <RupiahInput id="edit-cashacc-opening" name="opening" defaultValue={cashAccount.opening} placeholder="0" />
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
