"use client";

import { useState, useTransition } from "react";
import { setDocHandoverDate } from "@/app/(app)/klien/actions";

function toDateInputValue(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function DocHandoverDateInput({ type, id, value }: { type: "bj" | "outsourcing"; id: string; value: Date | null }) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(value ? toDateInputValue(value) : "");

  function handleChange(dateRaw: string) {
    setLocal(dateRaw);
    startTransition(() => setDocHandoverDate(type, id, dateRaw));
  }

  return (
    <input
      className="input"
      type="date"
      value={local}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      style={{ minHeight: 28, fontSize: 12, padding: "2px 6px" }}
      title="Tanggal dokumen invoice diserahkan ke klien"
    />
  );
}
