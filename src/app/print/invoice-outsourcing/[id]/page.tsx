import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { baseSalary, formatRp } from "@/lib/payroll";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function InvoiceOutsourcingPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true } });
  if (!inv) notFound();

  const employees = await db.employee.findMany({
    where: { clientId: inv.clientId, status: "aktif" },
    include: { position: true, salaryComponents: true },
    orderBy: { name: "asc" },
  });

  const feePer = inv.client.feeType === "percent" ? inv.client.feeValue / 100 : 0;
  const rows = employees.map((e) => {
    const gaji = baseSalary(e.salaryComponents);
    const fee = inv.client.feeType === "percent" ? Math.round(gaji * feePer) : inv.client.feeValue;
    return { e, gaji, fee, subtotal: gaji + fee };
  });

  const feeLabel = inv.client.feeType === "percent" ? inv.client.feeValue + "% dari gaji pokok" : "Rp" + inv.client.feeValue.toLocaleString("id-ID") + " per karyawan";
  const periodLabel = new Date(inv.period + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <PrintDocument
      title={"Tagihan — " + inv.client.name}
      docTitle="Invoice Jasa Outsourcing"
      meta={
        <>
          Ditagihkan kepada: <strong>{inv.client.name}</strong>
          <br />
          {inv.client.address || "-"}
          <br />
          No. Invoice: <strong>{inv.invoiceNo}</strong> &middot; Periode: {periodLabel} &middot; Skema fee: {feeLabel} &middot; {rows.length} karyawan
        </>
      }
      signLeftLabel="Diterima oleh"
      signLeftName={inv.client.name}
    >
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Posisi</th>
            <th>Gaji pokok</th>
            <th>Fee jasa</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.e.id}>
              <td>{r.e.name}</td>
              <td>{r.e.position.name}</td>
              <td>{formatRp(r.gaji)}</td>
              <td>{formatRp(r.fee)}</td>
              <td>{formatRp(r.subtotal)}</td>
            </tr>
          ))}
          <tr className="total">
            <td colSpan={4} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif" }}>Total Tagihan</td>
            <td>{formatRp(inv.total)}</td>
          </tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}
