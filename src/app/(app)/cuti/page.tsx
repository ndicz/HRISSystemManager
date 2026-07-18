import { db } from "@/lib/db";
import { AddLeaveDialog } from "@/components/AddLeaveDialog";
import { CutiTable } from "@/components/CutiTable";

export default async function CutiPage() {
  const [requests, employees] = await Promise.all([
    db.leaveRequest.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" } }),
    db.employee.findMany({ where: { status: "aktif" }, select: { id: true, name: true } }),
  ]);

  const menunggu = requests.filter((r) => r.status === "menunggu").length;

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Cuti</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Pengajuan dan persetujuan cuti karyawan</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
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
        <AddLeaveDialog employees={employees} />
      </div>

      <CutiTable requests={requests} />
    </div>
  );
}
