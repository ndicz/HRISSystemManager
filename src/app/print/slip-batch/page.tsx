import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bestAttendanceMonth, computeMonthlyPayroll, formatRp, resolvePayrollRate, resolvePayrollEntry, resolveOvertimeDays, resolveAssignments } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { PRINT_CSS, PrintDocumentInner } from "@/components/print/PrintDocument";
import { AutoPrint } from "@/components/print/AutoPrint";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

// Batch version of /print/slip/[employeeId] — same per-employee slip
// layout, stacked one per printed page (via PrintDocumentInner's
// page-break), under a single shared <style> + one print trigger instead
// of one per employee. Employee selection (per tempat kerja / per posisi)
// happens on the Penggajian page itself via its existing filters — this
// route just prints whichever ids it's given.
export default async function SlipBatchPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; period?: string }>;
}) {
  const { ids: idsParam, period: periodParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) notFound();

  const [employees, payrollRates] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: ids } },
      include: {
        site: true, position: true, salaryComponents: true, payrollEntries: true, overtimeDays: true,
        attendance: { select: { date: true, status: true, lateMin: true } },
        assignments: { select: { cost: true, status: true, period: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.payrollRate.findMany(),
  ]);
  if (employees.length === 0) notFound();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <AutoPrint title={`Slip Gaji Batch (${employees.length} karyawan)`} />
      {employees.map((emp, idx) => {
        const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam)
          ? periodParam
          : bestAttendanceMonth(emp.attendance) ?? monthKey(new Date());
        const rate = resolvePayrollRate(payrollRates, period, emp.siteId);
        const entry = resolvePayrollEntry(emp.payrollEntries, period);
        const overtimeDays = resolveOvertimeDays(emp.overtimeDays, period);
        const assignments = resolveAssignments(emp.assignments, period);
        const p = computeMonthlyPayroll(emp, emp.salaryComponents, emp.attendance, period, { rate, entry, overtimeDays, assignments });
        const periode = periodLabel(period);

        return (
          <PrintDocumentInner
            key={emp.id}
            docTitle="Slip Gaji Karyawan"
            pageBreak={idx < employees.length - 1}
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
                    <tr><td>Allowance</td><td>{formatRp(p.allowance)}</td></tr>
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
          </PrintDocumentInner>
        );
      })}
    </>
  );
}
