import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bestAttendanceMonth, computeMonthlyPayroll, formatRp } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { PrintDocument } from "@/components/print/PrintDocument";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

export default async function SlipPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { employeeId } = await params;
  const { period: periodParam } = await searchParams;
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    include: { site: true, position: true, salaryComponents: true, attendance: true },
  });
  if (!emp) notFound();

  const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam)
    ? periodParam
    : bestAttendanceMonth(emp.attendance) ?? monthKey(new Date());
  const p = computeMonthlyPayroll(emp, emp.salaryComponents, emp.attendance, period);
  const periode = periodLabel(period);

  return (
    <PrintDocument
      title={"Slip Gaji — " + emp.name}
      docTitle="Slip Gaji Karyawan"
      meta={
        <>
          Nama: <strong>{emp.name}</strong>
          <br />
          {emp.site.name} &middot; {emp.position.name}
          <br />
          Periode: {periode}
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
          <tr><td>Potongan absensi</td><td>-{formatRp(p.potonganAbsensi)}</td></tr>
          <tr><td>Potongan BPJS</td><td>-{formatRp(p.bpjs)}</td></tr>
          <tr>
            <td>Potongan kasbon{emp.kasbonCicilan > 1 ? ` (cicilan ${emp.kasbonCicilan}x dari total ${formatRp(emp.kasbon)})` : ""}</td>
            <td>-{formatRp(p.kasbonBulanIni)}</td>
          </tr>
          <tr className="total"><td>Total diterima</td><td>{formatRp(p.total)}</td></tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}
