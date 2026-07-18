"use client";

import { useTransition } from "react";
import { setBudget } from "@/app/(app)/kas/actions";

export function BudgetEditButton({ accountId, current, accountName }: { accountId: string; current: number; accountName: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const input = window.prompt("Anggaran bulanan untuk " + accountName + " (Rp):", String(current));
    if (input == null) return;
    const val = Math.max(0, parseInt(input.replace(/\D/g, ""), 10) || 0);
    startTransition(() => setBudget(accountId, val));
  }

  return (
    <button type="button" className="btn btn-ghost" disabled={pending} onClick={handleClick}>
      Atur
    </button>
  );
}
