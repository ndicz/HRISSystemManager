"use client";

import { useState, useTransition } from "react";
import { completeAssignment } from "@/app/(app)/karyawan/actions";
import { formatActionError } from "@/lib/errors";

export function AssignmentActions({ id, disabled, period }: { id: string; disabled: boolean; period: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try { await completeAssignment(id); } catch (err) { setError(formatActionError(err)); }
          });
        }}
      >
        {disabled ? "Selesai" : "Tandai selesai"}
      </button>
      {!disabled && (
        <span style={{ fontSize: 11, opacity: 0.55 }}>
          {period ? `Dibayar bersama gaji periode ${period}` : "Otomatis tercatat sebagai pengeluaran di Kas"}
        </span>
      )}
      {error && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}
