"use client";

import { setLeaveStatus } from "@/app/(app)/cuti/actions";
import { useActionRunner } from "@/lib/useActionRunner";

export function LeaveActions({ id, disabled }: { id: string; disabled: boolean }) {
  const { pending, error, run } = useActionRunner();

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || pending}
        onClick={() => run(() => setLeaveStatus(id, "disetujui"))}
      >
        Setujui
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || pending}
        onClick={() => run(() => setLeaveStatus(id, "ditolak"))}
      >
        Tolak
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}
