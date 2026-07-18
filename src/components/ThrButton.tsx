"use client";

import { useTransition } from "react";
import { bayarThr } from "@/app/(app)/penggajian/actions";

export function ThrButton({ employeeId, disabled }: { employeeId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="btn btn-ghost" disabled={disabled || pending} onClick={() => startTransition(() => bayarThr(employeeId))}>
      Tandai dibayar
    </button>
  );
}
