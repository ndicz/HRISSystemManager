import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computePayroll, formatRp } from "@/lib/payroll";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function SlipPrintPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    include: { site: true, position: true, salaryComponents: true },
  });
  if (!emp) notFound();

  const p = computePayroll(emp, emp.salaryComponents);
  const periode = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

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
          <tr><td>Potongan BPJS &amp; kasbon</td><td>-{formatRp(p.bpjs + emp.kasbon)}</td></tr>
          <tr className="total"><td>Total diterima</td><td>{formatRp(p.total)}</td></tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}
