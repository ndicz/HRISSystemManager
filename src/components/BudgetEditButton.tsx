"use client";

import { useState } from "react";
import { setBudget } from "@/app/(app)/kas/actions";
import { RupiahInput } from "@/components/RupiahInput";
import { useActionRunner } from "@/lib/useActionRunner";

// Inline editor (was a browser prompt with raw digits): same Rupiah field
// with thousand separators as every other amount in the app.
export function BudgetEditButton({ accountId, current, accountName }: { accountId: string; current: number; accountName: string }) {
  const { pending, error, run } = useActionRunner();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);

  if (!editing) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => { setValue(current); setEditing(true); }}>
        Atur
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <RupiahInput
        name={"budget-" + accountId}
        defaultValue={current}
        onValueChange={setValue}
        placeholder="0"
        style={{ width: 140, minHeight: 30 }}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        aria-label={"Simpan anggaran " + accountName}
        onClick={() => run(async () => { await setBudget(accountId, Math.max(0, value)); setEditing(false); })}
      >
        {pending ? "…" : "Simpan"}
      </button>
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setEditing(false)}>Batal</button>
      {error && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
    </span>
  );
}
