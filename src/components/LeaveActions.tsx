"use client";

import { useTransition } from "react";
import { setLeaveStatus } from "@/app/(app)/cuti/actions";

export function LeaveActions({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || pending}
        onClick={() => startTransition(() => setLeaveStatus(id, "disetujui"))}
      >
        Setujui
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || pending}
        onClick={() => startTransition(() => setLeaveStatus(id, "ditolak"))}
      >
        Tolak
      </button>
    </div>
  );
}
