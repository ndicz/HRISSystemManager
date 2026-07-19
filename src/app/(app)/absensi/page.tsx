import { db } from "@/lib/db";
import { AbsensiTable } from "@/components/AbsensiTable";
import { ImportAttendanceDialog } from "@/components/ImportAttendanceDialog";

export default async function AbsensiPage() {
  const [employees, sites] = await Promise.all([
    db.employee.findMany({
      where: { status: "aktif" },
      include: { site: true, position: true },
      orderBy: { name: "asc" },
    }),
    db.site.findMany({ select: { id: true, name: true } }),
  ]);

  const hadirCount = employees.filter((e) => e.attStatus === "Hadir").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h1 style={{ margin: 0 }}>Absensi Karyawan</h1>
          <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Kehadiran harian per tempat kerja</p>
        </div>
        <ImportAttendanceDialog sites={sites} />
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="card">
          <div className="card-kicker">Total karyawan</div>
          <div className="card-title">{employees.length}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Hadir hari ini</div>
          <div className="card-title">{hadirCount}</div>
        </div>
        <div className="card">
          <div className="card-kicker">% Kehadiran</div>
          <div className="card-title">{employees.length > 0 ? ((hadirCount / employees.length) * 100).toFixed(1) : "0.0"}%</div>
        </div>
      </div>

      <AbsensiTable employees={employees} />
    </div>
  );
}
