import { db } from "@/lib/db";
import { AddEmployeeDialog } from "@/components/AddEmployeeDialog";
import { AddSiteDialog } from "@/components/AddSiteDialog";
import { AddPositionDialog } from "@/components/AddPositionDialog";
import { AddAssignmentDialog } from "@/components/AddAssignmentDialog";
import { ImportBpjsDialog } from "@/components/ImportBpjsDialog";
import { KaryawanTable } from "@/components/KaryawanTable";
import { SiteTable } from "@/components/SiteTable";
import { PositionTable } from "@/components/PositionTable";
import { AssignmentTable } from "@/components/AssignmentTable";
import { ResignedTable } from "@/components/ResignedTable";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function KaryawanPage() {
  const [employees, resigned, sitesFull, positions, clients, assignments] = await Promise.all([
    db.employee.findMany({
      where: { status: "aktif" },
      include: { site: true, position: true, salaryComponents: true },
      orderBy: { createdAt: "desc" },
    }),
    db.employee.findMany({
      where: { status: "resign" },
      include: { site: true, position: true },
      orderBy: { resignDate: "desc" },
    }),
    db.site.findMany({ include: { employees: true }, orderBy: { createdAt: "desc" } }),
    db.position.findMany({ include: { employees: true } }),
    db.client.findMany({ select: { id: true, name: true } }),
    db.assignment.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const sites = sitesFull.map((s) => ({ id: s.id, name: s.name }));
  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name, empCode: e.empCode }));

  return (
    <div>
      <PageHeader
        icon={NAV_ICONS["/karyawan"]}
        title="Karyawan & Tempat Kerja"
        subtitle="Data karyawan dan lokasi penempatan"
        actions={<><ImportBpjsDialog /><AddEmployeeDialog sites={sites} positions={positions} clients={clients} /></>}
      />

      <KaryawanTable employees={employees} sites={sites} />

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Tempat Kerja</div>
          <AddSiteDialog />
        </div>
        <SiteTable sites={sitesFull} />
      </div>

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Posisi</div>
          <AddPositionDialog />
        </div>
        <PositionTable positions={positions} />
      </div>

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Penugasan Tambahan</div>
          <AddAssignmentDialog employees={employeeOptions} />
        </div>
        <AssignmentTable assignments={assignments} />
      </div>

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Riwayat Karyawan Keluar</div>
        <ResignedTable resigned={resigned} />
      </div>
    </div>
  );
}
