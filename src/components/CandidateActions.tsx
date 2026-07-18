"use client";

import { useTransition } from "react";
import { advanceCandidate, rejectCandidate } from "@/app/(app)/rekrutmen/actions";

const ADVANCE_LABEL: Record<string, string> = {
  lamaran: "Jadwalkan interview",
  interview: "Terima",
  diterima: "Aktifkan sebagai karyawan",
};

export function CandidateActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const advanceDisabled = status === "aktif" || status === "ditolak";
  const rejectDisabled = status === "diterima" || status === "aktif" || status === "ditolak";

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={advanceDisabled || pending}
        onClick={() => startTransition(() => advanceCandidate(id))}
      >
        {ADVANCE_LABEL[status] ?? "Aktif"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={rejectDisabled || pending}
        onClick={() => startTransition(() => rejectCandidate(id))}
      >
        Tolak
      </button>
    </div>
  );
}
