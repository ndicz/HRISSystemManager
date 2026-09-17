import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bestPayrollPeriod, computeMonthlyPayroll, formatRp, payrollPeriodKey, payrollPeriodLabel, resolvePayrollRate, resolvePayrollEntry, resolveOvertimeDays, resolveAssignments } from "@/lib/payroll";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function SlipPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { employeeId } = await params;
  const { period: periodParam } = await searchParams;
  const [emp, payrollRates, latenessBrackets] = await Promise.all([
    db.employee.findUnique({
      where: { id: employeeId },
      include: {
        site: true, position: true, salaryComponents: true, payrollEntries: true, overtimeDays: true,
        attendance: { select: { date: true, status: true, lateMin: true } },
        assignments: { select: { cost: true, status: true, period: true } },
      },
    }),
    db.payrollRate.findMany(),
    db.latenessBracket.findMany(),
  ]);
  if (!emp) notFound();

  const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam)
    ? periodParam
    : bestPayrollPeriod(emp.attendance) ?? payrollPeriodKey(new Date());
  const rate = resolvePayrollRate(payrollRates, period, emp.siteId);
  const entry = resolvePayrollEntry(emp.payrollEntries, period);
  const overtimeDays = resolveOvertimeDays(emp.overtimeDays, period);
  const assignments = resolveAssignments(emp.assignments, period);
  const p = computeMonthlyPayroll(emp, emp.salaryComponents, emp.attendance, period, { rate, entry, overtimeDays, assignments, latenessBrackets, site: emp.site });
  const periode = payrollPeriodLabel(period);

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
          {p.usesFlatRate ? (
            <>
              <tr><td>Gaji pokok</td><td>{formatRp(p.gajiPokok)}</td></tr>
              <tr><td>Lembur reguler</td><td>{formatRp(p.lemburReguler)}</td></tr>
              <tr><td>Lembur hari libur</td><td>{formatRp(p.lemburMerah)}</td></tr>
              <tr><td>Bonus</td><td>{formatRp(p.allowance)}</td></tr>
              {p.penugasanTambahan > 0 && <tr><td>Penugasan tambahan</td><td>{formatRp(p.penugasanTambahan)}</td></tr>}
              <tr><td>Potongan izin</td><td>-{formatRp(p.potonganIzin)}</td></tr>
              <tr><td>Potongan alfa</td><td>-{formatRp(p.potonganAlpha)}</td></tr>
              <tr><td>Potongan terlambat</td><td>-{formatRp(p.potonganTerlambat)}</td></tr>
              <tr><td>Potongan BPJS Kesehatan</td><td>-{formatRp(p.bpjsKesehatan)}</td></tr>
              <tr><td>Potongan BPJS Ketenagakerjaan</td><td>-{formatRp(p.bpjsKetenagakerjaan)}</td></tr>
              <tr>
                <td>Potongan kasbon{emp.kasbonCicilan > 1 ? ` (cicilan ${emp.kasbonCicilan}x dari total ${formatRp(emp.kasbon)})` : ""}</td>
                <td>-{formatRp(p.kasbonBulanIni)}</td>
              </tr>
              <tr className="total"><td>Total diterima</td><td>{formatRp(p.total)}</td></tr>
            </>
          ) : (
            <>
              <tr><td>Gaji pokok</td><td>{formatRp(p.gajiPokok)}</td></tr>
              <tr><td>Lembur</td><td>{formatRp(p.lembur)}</td></tr>
              {p.allowance > 0 && <tr><td>Bonus</td><td>{formatRp(p.allowance)}</td></tr>}
              {p.penugasanTambahan > 0 && <tr><td>Penugasan tambahan</td><td>{formatRp(p.penugasanTambahan)}</td></tr>}
              <tr><td>Potongan absensi</td><td>-{formatRp(p.potonganAbsensi)}</td></tr>
              <tr><td>Potongan BPJS Kesehatan</td><td>-{formatRp(p.bpjsKesehatan)}</td></tr>
              <tr><td>Potongan BPJS Ketenagakerjaan</td><td>-{formatRp(p.bpjsKetenagakerjaan)}</td></tr>
              <tr>
                <td>Potongan kasbon{emp.kasbonCicilan > 1 ? ` (cicilan ${emp.kasbonCicilan}x dari total ${formatRp(emp.kasbon)})` : ""}</td>
                <td>-{formatRp(p.kasbonBulanIni)}</td>
              </tr>
              <tr className="total"><td>Total diterima</td><td>{formatRp(p.total)}</td></tr>
            </>
          )}
        </tbody>
      </table>
    </PrintDocument>
  );
}
