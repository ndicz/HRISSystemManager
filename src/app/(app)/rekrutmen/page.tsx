import { db } from "@/lib/db";
import { AddCandidateDialog } from "@/components/AddCandidateDialog";
import { RekrutmenTable } from "@/components/RekrutmenTable";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

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
      <PageHeader
        icon={NAV_ICONS["/rekrutmen"]}
        title="Rekrutmen"
        subtitle="Pipeline lamaran, interview, sampai aktivasi karyawan baru"
        actions={<AddCandidateDialog positions={positions} />}
      />

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card stat-gradient stat-gradient-a"><div className="card-kicker">Lamaran masuk</div><div className="card-title">{counts.lamaran}</div></div>
        <div className="card"><div className="card-kicker">Interview</div><div className="card-title">{counts.interview}</div></div>
        <div className="card stat-gradient stat-gradient-b"><div className="card-kicker">Diterima, belum aktif</div><div className="card-title">{counts.diterima}</div></div>
        <div className="card"><div className="card-kicker">Ditolak</div><div className="card-title">{counts.ditolak}</div></div>
      </div>

      <RekrutmenTable candidates={candidates} positions={positions} />
    </div>
  );
}
