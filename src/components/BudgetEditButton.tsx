"use client";

import { setBudget } from "@/app/(app)/kas/actions";
import { useActionRunner } from "@/lib/useActionRunner";

export function BudgetEditButton({ accountId, current, accountName }: { accountId: string; current: number; accountName: string }) {
  const { pending, error, run } = useActionRunner();

  function handleClick() {
    const input = window.prompt("Anggaran bulanan untuk " + accountName + " (Rp):", current.toLocaleString("id-ID"));
    if (input == null) return;
    const val = Math.max(0, parseInt(input.replace(/\D/g, ""), 10) || 0);
    run(() => setBudget(accountId, val));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={handleClick}>
        Atur
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
    </>
  );
}
