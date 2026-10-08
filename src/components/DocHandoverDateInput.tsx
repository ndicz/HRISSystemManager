"use client";

import { useState } from "react";
import { setDocHandoverDate } from "@/app/(app)/klien/actions";
import { useActionRunner } from "@/lib/useActionRunner";

function toDateInputValue(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function DocHandoverDateInput({ type, id, value }: { type: "bj" | "outsourcing"; id: string; value: Date | null }) {
  const { pending, error, run } = useActionRunner();
  const [local, setLocal] = useState(value ? toDateInputValue(value) : "");

  function handleChange(dateRaw: string) {
    setLocal(dateRaw);
    run(() => setDocHandoverDate(type, id, dateRaw));
  }

  return (
    <>
      <input
        className="input"
        type="date"
        value={local}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        style={{ minHeight: 28, fontSize: 12, padding: "2px 6px" }}
        title="Tanggal dokumen invoice diserahkan ke klien"
      />
      {error && <div style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</div>}
    </>
  );
}
