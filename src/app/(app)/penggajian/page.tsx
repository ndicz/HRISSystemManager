import { db } from "@/lib/db";
import { PenggajianTabs } from "@/components/PenggajianTabs";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

// Every employee's *entire* attendance history gets fetched on this page —
// with no bound, that grows every month forever and this page would only
// keep getting slower. A rolling 6-month window comfortably covers the
// period picker (current + recent months, the only thing anyone actually
// reviews here) without silently hiding anything currently in the
// database, while capping how much this can cost a year from now.
function attendanceWindowStart() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d;
}

export default async function PenggajianPage() {
  const [employees, rates, sitesFull] = await Promise.all([
    db.employee.findMany({
      where: { status: "aktif" },
      include: {
        site: true, position: true, salaryComponents: true, payrollEntries: true,
        // Only date/status/lateMin ever feed the payroll math (monthlyAttendanceTally,
        // bestAttendanceMonth) — checkIn/checkOut/location etc. are only shown via the
        // separate per-employee Rekap Bulanan fetch, not from this preloaded list, so
        // pulling every column here just adds transfer + row-mapping cost for nothing.
        attendance: { where: { date: { gte: attendanceWindowStart() } }, select: { date: true, status: true, lateMin: true } },
        allowancePayments: { orderBy: { date: "desc" } },
        overtimeDays: { orderBy: { date: "asc" } },
        assignments: { select: { cost: true, status: true, period: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.payrollRate.findMany(),
    db.site.findMany({ select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/penggajian"]} title="Penggajian" subtitle="Perhitungan gaji, lembur, potongan, dan THR" />

      <PenggajianTabs employees={employees} rates={rates} sites={sitesFull} />
    </div>
  );
}
