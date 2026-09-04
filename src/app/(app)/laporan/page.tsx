import { db } from "@/lib/db";
import { LaporanKehadiranTabs } from "@/components/LaporanKehadiranTabs";

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
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Laporan Kehadiran</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Performa kehadiran karyawan, bulanan dan tahunan</p>
      </div>

      <LaporanKehadiranTabs records={records} employees={employees} />
    </div>
  );
}
