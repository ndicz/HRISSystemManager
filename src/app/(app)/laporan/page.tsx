import { db } from "@/lib/db";
import { LaporanKehadiranTabs } from "@/components/LaporanKehadiranTabs";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function LaporanPage() {
  const [records, employees] = await Promise.all([
    db.attendanceRecord.findMany({ select: { date: true, status: true, employeeId: true } }),
    db.employee.findMany({
      select: { id: true, name: true, site: { select: { name: true } }, position: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/laporan"]} title="Laporan Kehadiran" subtitle="Performa kehadiran karyawan, bulanan dan tahunan" />

      <LaporanKehadiranTabs records={records} employees={employees} />
    </div>
  );
}
