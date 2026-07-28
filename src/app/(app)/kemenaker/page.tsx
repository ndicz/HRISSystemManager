import { db } from "@/lib/db";
import { computePayroll, computeUmr, computeBpjsKesehatan, formatRp } from "@/lib/payroll";
import { KemenakerTable } from "@/components/KemenakerTable";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function KemenakerPage() {
  const employees = await db.employee.findMany({
    where: { status: "aktif" },
    include: { site: true, salaryComponents: true },
    orderBy: { name: "asc" },
  });

  const rows = employees.map((e) => {
    const p = computePayroll(e, e.salaryComponents);
    const umr = computeUmr(p.gajiPokok, e.site.umr);
    const bk = computeBpjsKesehatan(p.gajiPokok);
    return {
      id: e.id,
      name: e.name,
      siteName: e.site.name,
      umrWilayah: e.site.umr,
      gajiPokok: p.gajiPokok,
      compliant: umr.compliant,
      bpjsTk: umr.bpjsTk,
      bpjsKesehatan: bk.perusahaan,
    };
  });

  const compliantCount = rows.filter((r) => r.compliant).length;
  const compliancePct = employees.length > 0 ? ((compliantCount / employees.length) * 100).toFixed(1) : "0.0";
  const sumBpjsTk = rows.reduce((s, r) => s + r.bpjsTk, 0);

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/kemenaker"]} title="Laporan Kemenaker" subtitle="Kepatuhan UMR, iuran BPJS Ketenagakerjaan & Kesehatan" />

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card stat-gradient stat-gradient-a">
          <div className="card-kicker">Kepatuhan UMR/UMK</div>
          <div className="card-title" style={{ fontSize: 22 }}>{compliancePct}%</div>
          <p className="card-body">{employees.length - compliantCount} karyawan di bawah UMR</p>
        </div>
        <div className="card">
          <div className="card-kicker">Iuran BPJS Ketenagakerjaan</div>
          <div className="card-title" style={{ fontSize: 18 }}>{formatRp(sumBpjsTk)}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Iuran BPJS Kesehatan</div>
          <div className="card-title" style={{ fontSize: 18 }}>{formatRp(rows.reduce((s, r) => s + r.bpjsKesehatan, 0))}</div>
        </div>
      </div>

      <KemenakerTable rows={rows} />
      <p style={{ fontSize: 12, opacity: 0.55, marginTop: "var(--space-3)", maxWidth: "70ch" }}>
        UMR/UMK dan tarif iuran BPJS adalah estimasi — sesuaikan dengan penetapan resmi Kemenaker, Disnaker, dan BPJS setempat setiap tahun.
      </p>
    </div>
  );
}
