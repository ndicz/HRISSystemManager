"use client";

import { payPayable } from "@/app/(app)/kas/actions";
import { useActionRunner } from "@/lib/useActionRunner";

export function PayableActions({ id, disabled }: { id: string; disabled: boolean }) {
  const { pending, error, run } = useActionRunner();
  return (
    <>
      <button type="button" className="btn btn-ghost" disabled={disabled || pending} onClick={() => run(() => payPayable(id))}>
        Bayar
      </button>
      {error && <div style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</div>}
    </>
  );
}
