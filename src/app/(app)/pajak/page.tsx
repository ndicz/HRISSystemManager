import { db } from "@/lib/db";
import { computePayroll, computeTax, formatRp } from "@/lib/payroll";
import { PajakTable } from "@/components/PajakTable";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function PajakPage() {
  const employees = await db.employee.findMany({
    where: { status: "aktif" },
    include: { site: true, salaryComponents: true },
    orderBy: { name: "asc" },
  });

  const rows = employees.map((e) => {
    const p = computePayroll(e, e.salaryComponents);
    const tx = computeTax(p.gajiPokok, p.lembur);
    return { id: e.id, name: e.name, siteName: e.site.name, brutoBulan: tx.brutoBulan, pkp: tx.pkp, pph21Bulan: tx.pph21Bulan };
  });

  const sumPph21 = rows.reduce((s, r) => s + r.pph21Bulan, 0);
  const kenaPajakCount = rows.filter((r) => r.pkp > 0).length;

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/pajak"]} title="Laporan Pajak" subtitle="Perhitungan PPh 21 (estimasi)" />

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card stat-gradient stat-gradient-a">
          <div className="card-kicker">Total PPh 21 bulan ini</div>
          <div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumPph21)}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Karyawan kena pajak</div>
          <div className="card-title" style={{ fontSize: 22 }}>{kenaPajakCount}</div>
          <p className="card-body">Dari {employees.length} karyawan, asumsi PTKP TK/0</p>
        </div>
      </div>

      <PajakTable rows={rows} />
      <p style={{ fontSize: 12, opacity: 0.55, marginTop: "var(--space-3)", maxWidth: "70ch" }}>
        Perhitungan PPh 21 memakai asumsi status PTKP TK/0 dan tarif progresif UU HPP — sesuaikan dengan data NPWP &amp; status PTKP sebenarnya sebelum pelaporan resmi.
      </p>
    </div>
  );
}
