import { db } from "@/lib/db";
import { AbsensiTable } from "@/components/AbsensiTable";
import { ImportAttendanceDialog } from "@/components/ImportAttendanceDialog";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

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
      <PageHeader
        icon={NAV_ICONS["/absensi"]}
        title="Absensi Karyawan"
        subtitle="Kehadiran harian per tempat kerja"
        actions={<ImportAttendanceDialog sites={sites} />}
      />

      <AbsensiTable employees={employees} sites={sites} />
    </div>
  );
}
