"use client";

import { useState, useRef } from "react";
import { addTransfer } from "@/app/(app)/kas/actions";

type Option = { id: string; name: string };

export function TransferDialog({ cashAccounts, disabled }: { cashAccounts: Option[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addTransfer(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Periode berjalan sudah ditutup" : undefined}>Transfer antar rekening</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Transfer antar rekening</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="fromId">Dari rekening</label>
                  <select className="input" id="fromId" name="fromId" required>
                    {cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="toId">Ke rekening</label>
                  <select className="input" id="toId" name="toId" required>
                    {cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="amount">Jumlah (Rp)</label>
                <input className="input" id="amount" name="amount" type="number" required placeholder="0" />
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Memproses…" : "Transfer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
