"use client";

import { useTransition } from "react";
import { advanceInvoiceStatus } from "@/app/(app)/klien/actions";

const LABEL: Record<string, string> = { draft: "Kirim tagihan", terkirim: "Tandai lunas", lunas: "Lunas" };

export function InvoiceActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost"
      disabled={status === "lunas" || pending}
      onClick={() => startTransition(() => advanceInvoiceStatus(id))}
    >
      {LABEL[status]}
    </button>
  );
}
