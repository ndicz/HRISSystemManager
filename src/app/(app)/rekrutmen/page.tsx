import { db } from "@/lib/db";
import { AddCandidateDialog } from "@/components/AddCandidateDialog";
import { RekrutmenTable } from "@/components/RekrutmenTable";

export default async function RekrutmenPage() {
  const [candidates, positions] = await Promise.all([
    db.candidate.findMany({ orderBy: { createdAt: "desc" } }),
    db.position.findMany({ select: { id: true, name: true } }),
  ]);

  const counts = {
    lamaran: candidates.filter((c) => c.status === "lamaran").length,
    interview: candidates.filter((c) => c.status === "interview").length,
    diterima: candidates.filter((c) => c.status === "diterima").length,
    ditolak: candidates.filter((c) => c.status === "ditolak").length,
  };

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Rekrutmen</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Pipeline lamaran, interview, sampai aktivasi karyawan baru</p>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card"><div className="card-kicker">Lamaran masuk</div><div className="card-title">{counts.lamaran}</div></div>
        <div className="card"><div className="card-kicker">Interview</div><div className="card-title">{counts.interview}</div></div>
        <div className="card"><div className="card-kicker">Diterima, belum aktif</div><div className="card-title">{counts.diterima}</div></div>
        <div className="card"><div className="card-kicker">Ditolak</div><div className="card-title">{counts.ditolak}</div></div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
        <AddCandidateDialog positions={positions} />
      </div>

      <RekrutmenTable candidates={candidates} />
    </div>
  );
}
