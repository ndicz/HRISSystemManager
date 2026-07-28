import { db } from "@/lib/db";
import { AddLeaveDialog } from "@/components/AddLeaveDialog";
import { CutiTable } from "@/components/CutiTable";
import { cutiTerpakai } from "@/lib/leave";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";
import { Avatar } from "@/components/Avatar";

export default async function CutiPage() {
  const [requests, employees] = await Promise.all([
    db.leaveRequest.findMany({ include: { employee: { include: { site: true, position: true } } }, orderBy: { createdAt: "desc" } }),
    db.employee.findMany({ where: { status: "aktif" }, orderBy: { name: "asc" } }),
  ]);

  const menunggu = requests.filter((r) => r.status === "menunggu").length;

  const kuotaRows = employees.map((e) => {
    const terpakai = cutiTerpakai(requests.filter((r) => r.employeeId === e.id));
    return { id: e.id, name: e.name, empCode: e.empCode, kuota: e.cutiKuota, terpakai, sisa: e.cutiKuota - terpakai };
  });

  const employeeOptions = kuotaRows.map((k) => ({ id: k.id, name: k.name, empCode: k.empCode, sisa: k.sisa }));

  return (
    <div>
      <PageHeader
        icon={NAV_ICONS["/cuti"]}
        title="Cuti"
        subtitle="Pengajuan dan persetujuan cuti karyawan"
        actions={<AddLeaveDialog employees={employeeOptions} />}
      />

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card stat-gradient stat-gradient-a">
          <div className="card-kicker">Menunggu persetujuan</div>
          <div className="card-title">{menunggu}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Total pengajuan</div>
          <div className="card-title">{requests.length}</div>
        </div>
      </div>

      <CutiTable requests={requests} />

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Kuota Cuti Karyawan</div>
        {kuotaRows.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada karyawan.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kuota tahunan</th>
                <th>Terpakai</th>
                <th>Sisa</th>
              </tr>
            </thead>
            <tbody>
              {kuotaRows.map((k) => (
                <tr key={k.id}>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}><Avatar name={k.name} />{k.name}</span></td>
                  <td className="text-muted">{k.kuota} hari</td>
                  <td className="text-muted">{k.terpakai} hari</td>
                  <td>
                    <span className={k.sisa <= 0 ? "tag tag-neutral" : k.sisa <= 3 ? "tag tag-outline" : "tag tag-accent"}>
                      {k.sisa} hari
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, opacity: 0.55, marginTop: "var(--space-3)" }}>
          Kuota terpakai dihitung dari seluruh pengajuan cuti berstatus disetujui, sesuai jumlah hari kalender pengajuan.
        </p>
      </div>
    </div>
  );
}
