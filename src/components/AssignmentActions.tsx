"use client";

import { useTransition } from "react";
import { completeAssignment } from "@/app/(app)/karyawan/actions";

export function AssignmentActions({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <button type="button" className="btn btn-ghost" disabled={disabled || pending} onClick={() => startTransition(() => completeAssignment(id))}>
        {disabled ? "Selesai" : "Tandai selesai"}
      </button>
      {!disabled && (
        <span style={{ fontSize: 11, opacity: 0.55 }}>Otomatis tercatat sebagai pengeluaran di Kas</span>
      )}
    </div>
  );
}
