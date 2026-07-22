import { db } from "@/lib/db";
import { AddLeaveDialog } from "@/components/AddLeaveDialog";
import { CutiTable } from "@/components/CutiTable";
import { cutiTerpakai } from "@/lib/leave";

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
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Cuti</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Pengajuan dan persetujuan cuti karyawan</p>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker">Menunggu persetujuan</div>
          <div className="card-title">{menunggu}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Total pengajuan</div>
          <div className="card-title">{requests.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
        <AddLeaveDialog employees={employeeOptions} />
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
                  <td>{k.name}</td>
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
