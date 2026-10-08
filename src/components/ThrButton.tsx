"use client";

import { useState, useTransition } from "react";
import { bayarThr } from "@/app/(app)/penggajian/actions";
import { formatActionError } from "@/lib/errors";

export function ThrButton({ employeeId, disabled }: { employeeId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const res = await bayarThr(employeeId);
              if (res.error) setError(res.error);
            } catch (err) {
              setError(formatActionError(err));
            }
          });
        }}
      >
        {pending ? "Memproses…" : "Tandai dibayar"}
      </button>
      {error && <div style={{ fontSize: 11, color: "var(--color-danger)", maxWidth: 220 }}>{error}</div>}
    </div>
  );
}
