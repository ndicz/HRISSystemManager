import { db } from "@/lib/db";
import { AbsensiTable } from "@/components/AbsensiTable";
import { ImportAttendanceDialog } from "@/components/ImportAttendanceDialog";

// See penggajian/page.tsx's attendanceWindowStart comment — same reasoning
// applies here: unbounded history on every active employee only ever grows.
function attendanceWindowStart() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d;
}

export default async function AbsensiPage() {
  const [employees, sites] = await Promise.all([
    db.employee.findMany({
      where: { status: "aktif" },
      include: {
        site: true, position: true,
        attendance: { where: { date: { gte: attendanceWindowStart() } }, select: { date: true, status: true, lateMin: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.site.findMany({ select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <div className="page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div className="page-header">
          <h1 style={{ margin: 0 }}>Absensi Karyawan</h1>
          <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Kehadiran harian per tempat kerja</p>
        </div>
        <ImportAttendanceDialog sites={sites} />
      </div>

      <AbsensiTable employees={employees} sites={sites} />
    </div>
  );
}
