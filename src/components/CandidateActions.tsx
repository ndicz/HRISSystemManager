"use client";

import { useState } from "react";
import { advanceCandidate, rejectCandidate } from "@/app/(app)/rekrutmen/actions";
import { useActionRunner } from "@/lib/useActionRunner";

const ADVANCE_LABEL: Record<string, string> = {
  lamaran: "Jadwalkan interview",
  interview: "Terima",
  diterima: "Aktifkan sebagai karyawan",
};

export function CandidateActions({ id, status, sites }: { id: string; status: string; sites: { id: string; name: string }[] }) {
  const { pending, error, run } = useActionRunner();
  const [siteId, setSiteId] = useState("");
  const advanceDisabled = status === "aktif" || status === "ditolak";
  const rejectDisabled = status === "diterima" || status === "aktif" || status === "ditolak";
  // Activating creates the employee record, so it needs a tempat kerja.
  const needsSite = status === "diterima";

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {needsSite && (
        <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Tempat kerja" style={{ width: "auto", minWidth: 160 }}>
          <option value="">Pilih tempat kerja…</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        disabled={advanceDisabled || pending || (needsSite && !siteId)}
        onClick={() => run(() => advanceCandidate(id, siteId || undefined))}
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
