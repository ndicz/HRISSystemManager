"use client";

import { advanceCandidate, rejectCandidate } from "@/app/(app)/rekrutmen/actions";
import { useActionRunner } from "@/lib/useActionRunner";

const ADVANCE_LABEL: Record<string, string> = {
  lamaran: "Jadwalkan interview",
  interview: "Terima",
  diterima: "Aktifkan sebagai karyawan",
};

export function CandidateActions({ id, status }: { id: string; status: string }) {
  const { pending, error, run } = useActionRunner();
  const advanceDisabled = status === "aktif" || status === "ditolak";
  const rejectDisabled = status === "diterima" || status === "aktif" || status === "ditolak";

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={advanceDisabled || pending}
        onClick={() => run(() => advanceCandidate(id))}
      >
        {ADVANCE_LABEL[status] ?? "Aktif"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={rejectDisabled || pending}
        onClick={() => run(() => rejectCandidate(id))}
      >
        Tolak
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}
