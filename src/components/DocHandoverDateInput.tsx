"use client";

import { useState } from "react";
import { setDocHandoverDate } from "@/app/(app)/klien/actions";
import { useActionRunner } from "@/lib/useActionRunner";
import { DateInput } from "@/components/DateInput";

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
      <DateInput
        value={local}
        disabled={pending}
        onChange={handleChange}
        style={{ width: 140 }}
        inputStyle={{ minHeight: 28, fontSize: 12, padding: "2px 30px 2px 6px" }}
        title="Tanggal dokumen invoice diserahkan ke klien"
      />
      {error && <div style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</div>}
    </>
  );
}
