"use client";

import { useState, useRef } from "react";
import { addAccount } from "@/app/(app)/kas/actions";
import { formatActionError } from "@/lib/errors";
import { ACCOUNT_TYPES, suggestNextAccountCode, type AccountType } from "@/lib/coa";

type AccountOption = { code: string };

export function AddAccountDialog({ accounts }: { accounts: AccountOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<AccountType>("beban");
  const [code, setCode] = useState(() => suggestNextAccountCode(accounts, "beban"));
  const [codeTouched, setCodeTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleTypeChange(next: AccountType) {
    setType(next);
    // Once someone's typed their own code, switching Tipe shouldn't stomp
    // on it — the suggestion is a starting point, not something enforced.
    if (!codeTouched) setCode(suggestNextAccountCode(accounts, next));
  }

  function resetForm() {
    setType("beban");
    setCode(suggestNextAccountCode(accounts, "beban"));
    setCodeTouched(false);
    setError("");
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await addAccount(formData);
      setOpen(false);
      formRef.current?.reset();
      resetForm();
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  const activeType = ACCOUNT_TYPES.find((t) => t.value === type)!;

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>+ Akun baru</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(480px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah akun (COA)</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="type">Kategori</label>
                <select className="input" id="type" name="type" value={type} onChange={(e) => handleTypeChange(e.target.value as AccountType)}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: 12, opacity: 0.6, margin: "4px 0 0" }}>{activeType.hint}</p>
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="code">Kode</label>
                  <input
                    className="input" id="code" name="code" required value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }}
                  />
                  <p style={{ fontSize: 11, opacity: 0.55, margin: "4px 0 0" }}>{activeType.base}–{activeType.base + 999}</p>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="name">Nama akun</label>
                  <input className="input" id="name" name="name" required placeholder="Nama akun baru" />
                </div>
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
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
