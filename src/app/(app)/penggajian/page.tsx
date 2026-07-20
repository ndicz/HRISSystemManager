import { db } from "@/lib/db";
import { PenggajianTabs } from "@/components/PenggajianTabs";

export default async function PenggajianPage() {
  const employees = await db.employee.findMany({
    where: { status: "aktif" },
    include: { site: true, position: true, salaryComponents: true, attendance: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Penggajian</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Perhitungan gaji, lembur, potongan, dan THR</p>
      </div>

      <PenggajianTabs employees={employees} />
    </div>
  );
}
