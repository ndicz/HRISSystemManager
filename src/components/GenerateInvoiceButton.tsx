"use client";

import { useState, useTransition } from "react";
import { generateInvoices } from "@/app/(app)/klien/actions";

function currentPeriod() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function GenerateInvoiceButton() {
  const [period, setPeriod] = useState(currentPeriod());
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      {msg && <span className="text-muted" style={{ fontSize: 12 }}>{msg}</span>}
      <input
        type="month"
        className="input"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        style={{ width: 150 }}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await generateInvoices(period);
            setMsg(res.created > 0 ? `${res.created} tagihan dibuat` : "Tagihan sudah ada / diperbarui");
          })
        }
      >
        {pending ? "Memproses..." : "Generate tagihan"}
      </button>
    </div>
  );
}
