"use client";

import { useState, useRef } from "react";
import { updateTransaction } from "@/app/(app)/kas/actions";
import { RupiahInput } from "@/components/RupiahInput";

type Option = { id: string; name: string; type?: string };
type Tx = { id: string; date: Date; accountCoaId: string; cashAccountId: string; desc: string; amount: number; type: string };

function toDateInputValue(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function EditTransactionDialog({ tx, accounts, cashAccounts, disabled }: { tx: Tx; accounts: Option[]; cashAccounts: Option[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(tx.type);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const filteredAccounts = accounts.filter((a) => a.type === type);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateTransaction(tx.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Periode transaksi ini sudah ditutup" : undefined}>
        Edit
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit transaksi kas</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label>Tipe</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt">
                    <input type="radio" name="type" value="keluar" checked={type === "keluar"} onChange={() => setType("keluar")} />
                    Keluar
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="type" value="masuk" checked={type === "masuk"} onChange={() => setType("masuk")} />
                    Masuk
                  </label>
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-date">Tanggal</label>
                <input className="input" id="edit-date" name="date" type="date" defaultValue={toDateInputValue(tx.date)} required />
              </div>
              <div className="field">
                <label htmlFor="edit-accountCoaId">Akun (COA)</label>
                <select className="input" id="edit-accountCoaId" name="accountCoaId" defaultValue={tx.accountCoaId} required>
                  {filteredAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-cashAccountId">Rekening</label>
                <select className="input" id="edit-cashAccountId" name="cashAccountId" defaultValue={tx.cashAccountId} required>
                  {cashAccounts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-desc">Keterangan</label>
                <input className="input" id="edit-desc" name="desc" defaultValue={tx.desc} placeholder="Keterangan transaksi" />
              </div>
              <div className="field">
                <label htmlFor="edit-amount">Jumlah (Rp)</label>
                <RupiahInput id="edit-amount" name="amount" defaultValue={tx.amount} />
              </div>
              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
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
