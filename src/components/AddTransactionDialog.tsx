"use client";

import { useState, useRef } from "react";
import { addTransaction } from "@/app/(app)/kas/actions";
import { RupiahInput } from "@/components/RupiahInput";

type Option = { id: string; name: string; type?: string };

export function AddTransactionDialog({ accounts, cashAccounts, disabled }: { accounts: Option[]; cashAccounts: Option[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("keluar");
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const filteredAccounts = accounts.filter((a) => a.type === type);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addTransaction(formData);
      setOpen(false);
      formRef.current?.reset();
      setFormKey((k) => k + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Periode berjalan sudah ditutup" : undefined}>
        + Catat transaksi
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Catat transaksi kas</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
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
                <label htmlFor="accountCoaId">Akun (COA)</label>
                <select className="input" id="accountCoaId" name="accountCoaId" required>
                  {filteredAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cashAccountId">Rekening</label>
                <select className="input" id="cashAccountId" name="cashAccountId" required>
                  {cashAccounts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="desc">Keterangan</label>
                <input className="input" id="desc" name="desc" placeholder="Keterangan transaksi" />
              </div>
              <div className="field">
                <label htmlFor="amount">Jumlah (Rp)</label>
                <RupiahInput id="amount" name="amount" placeholder="0" />
              </div>
              <div className="field">
                <label htmlFor="attachment">Lampiran bukti (opsional)</label>
                <input className="input" id="attachment" name="attachment" type="file" accept="image/*,.pdf" />
              </div>
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
