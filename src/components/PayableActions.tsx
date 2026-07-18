"use client";

import { useTransition } from "react";
import { payPayable } from "@/app/(app)/kas/actions";

export function PayableActions({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="btn btn-ghost" disabled={disabled || pending} onClick={() => startTransition(() => payPayable(id))}>
      Bayar
    </button>
  );
}
