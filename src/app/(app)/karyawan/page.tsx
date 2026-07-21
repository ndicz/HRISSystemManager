import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { AddEmployeeDialog } from "@/components/AddEmployeeDialog";
import { AddSiteDialog } from "@/components/AddSiteDialog";
import { AddAssignmentDialog } from "@/components/AddAssignmentDialog";
import { AssignmentActions } from "@/components/AssignmentActions";
import { KaryawanTable } from "@/components/KaryawanTable";

export default async function KaryawanPage() {
  const [employees, resigned, sitesFull, positions, clients, assignments] = await Promise.all([
    db.employee.findMany({
      where: { status: "aktif" },
      include: { site: true, position: true },
      orderBy: { createdAt: "desc" },
    }),
    db.employee.findMany({
      where: { status: "resign" },
      include: { site: true, position: true },
      orderBy: { resignDate: "desc" },
    }),
    db.site.findMany({ include: { employees: true }, orderBy: { createdAt: "desc" } }),
    db.position.findMany({ select: { id: true, name: true } }),
    db.client.findMany({ select: { id: true, name: true } }),
    db.assignment.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const sites = sitesFull.map((s) => ({ id: s.id, name: s.name }));
  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div className="page-header">
          <h1 style={{ margin: 0 }}>Karyawan &amp; Tempat Kerja</h1>
          <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Data karyawan dan lokasi penempatan</p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
        <AddEmployeeDialog sites={sites} positions={positions} clients={clients} />
      </div>

      <KaryawanTable employees={employees} />

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Tempat Kerja</div>
          <AddSiteDialog />
        </div>
        {sitesFull.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada tempat kerja.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama lokasi</th>
                <th>Alamat</th>
                <th>Penanggung jawab</th>
                <th>UMR/UMK</th>
                <th>Karyawan</th>
              </tr>
            </thead>
            <tbody>
              {sitesFull.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="text-muted">{s.address}</td>
                  <td>{s.supervisor}</td>
                  <td>{formatRp(s.umr)}</td>
                  <td>{s.employees.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Penugasan Tambahan</div>
          <AddAssignmentDialog employees={employeeOptions} />
        </div>
        {assignments.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada penugasan tambahan.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Judul</th>
                <th>Mandays</th>
                <th>Biaya</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.employee.name}</td>
                  <td>{a.title}</td>
                  <td className="text-muted">{a.mandays} hari</td>
                  <td>{formatRp(a.cost)}</td>
                  <td>
                    <span className={a.status === "selesai" ? "tag tag-accent" : "tag tag-outline"}>
                      {a.status === "selesai" ? "Selesai" : "Berjalan"}
                    </span>
                  </td>
                  <td><AssignmentActions id={a.id} disabled={a.status === "selesai"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Riwayat Karyawan Keluar</div>
        {resigned.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada karyawan yang resign.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama</th>
                <th>Tempat kerja</th>
                <th>Posisi</th>
                <th>Tanggal resign</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {resigned.map((e) => (
                <tr key={e.id}>
                  <td className="text-muted">{e.empCode}</td>
                  <td>{e.name}</td>
                  <td>{e.site.name}</td>
                  <td>{e.position.name}</td>
                  <td className="text-muted">{e.resignDate ? e.resignDate.toLocaleDateString("id-ID") : "-"}</td>
                  <td>{e.resignReason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
