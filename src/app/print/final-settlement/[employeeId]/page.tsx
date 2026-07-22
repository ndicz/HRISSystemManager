import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computeFinalSettlement, formatRp } from "@/lib/payroll";
import { PrintDocument } from "@/components/print/PrintDocument";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

export default async function FinalSettlementPrintPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    include: { site: true, position: true, salaryComponents: true, attendance: { select: { date: true, status: true, lateMin: true } } },
  });
  if (!emp || emp.status !== "resign" || !emp.resignDate) notFound();

  const p = computeFinalSettlement(emp, emp.salaryComponents, emp.attendance, emp.resignDate);

  return (
    <PrintDocument
      title={"Slip Gaji Terakhir — " + emp.name}
      docTitle="Slip Gaji Terakhir (Penyelesaian Resign)"
      meta={
        <>
          Nama: <strong>{emp.name}</strong>
          <br />
          {emp.site.name} &middot; {emp.position.name}
          <br />
          Periode: {periodLabel(p.period)} (s.d. {emp.resignDate.toLocaleDateString("id-ID")})
        </>
      }
      signLeftLabel="Karyawan"
      signLeftName={emp.name}
      signRightLabel="HR & Payroll"
    >
      <table>
        <thead>
          <tr>
            <th>Komponen</th>
            <th>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Gaji pokok</td><td>{formatRp(p.gajiPokok)}</td></tr>
          <tr><td>Lembur</td><td>{formatRp(p.lembur)}</td></tr>
          <tr><td>Potongan absensi (s.d. tanggal resign)</td><td>-{formatRp(p.potonganAbsensi)}</td></tr>
          <tr><td>Potongan BPJS Kesehatan</td><td>-{formatRp(p.bpjsKesehatan)}</td></tr>
          <tr><td>Potongan BPJS Ketenagakerjaan</td><td>-{formatRp(p.bpjsKetenagakerjaan)}</td></tr>
          <tr><td>Pelunasan kasbon penuh</td><td>-{formatRp(p.kasbonBulanIni)}</td></tr>
          <tr className="total"><td>Total diterima (settlement akhir)</td><td>{formatRp(p.total)}</td></tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}
