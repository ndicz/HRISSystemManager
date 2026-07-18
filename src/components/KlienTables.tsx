"use client";

import { useMemo, useState } from "react";
import type { Client, Employee, InvoiceBj, InvoiceBjItem, Invoice } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { AddClientDialog } from "@/components/AddClientDialog";
import { AddInvoiceBjDialog } from "@/components/AddInvoiceBjDialog";
import { InvoiceBjActions } from "@/components/InvoiceBjActions";
import { InvoiceActions } from "@/components/InvoiceActions";
import { GenerateInvoiceButton } from "@/components/GenerateInvoiceButton";

function statusTag(status: string) {
  if (status === "lunas") return "tag tag-accent";
  if (status === "terkirim") return "tag tag-outline";
  return "tag tag-neutral";
}
function statusLabel(status: string) {
  if (status === "lunas") return "Lunas";
  if (status === "terkirim") return "Terkirim";
  return "Draft";
}
function invoiceTotal(items: { qty: number; price: number }[], withPpn: boolean) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  return withPpn ? Math.round(subtotal * 1.11) : subtotal;
}

type ClientRow = Client & { employees: Employee[] };
type InvoiceBjRow = InvoiceBj & { client: Client; items: InvoiceBjItem[] };
type InvoiceRow = Invoice & { client: Client };

export function KlienTables({
  clients,
  invoicesBj,
  invoices,
}: {
  clients: ClientRow[];
  invoicesBj: InvoiceBjRow[];
  invoices: InvoiceRow[];
}) {
  const [qClient, setQClient] = useState("");
  const [qBj, setQBj] = useState("");
  const [qInv, setQInv] = useState("");

  const filteredClients = useMemo(() => {
    const needle = qClient.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => [c.name, c.pic].join(" ").toLowerCase().includes(needle));
  }, [clients, qClient]);

  const filteredBj = useMemo(() => {
    const needle = qBj.trim().toLowerCase();
    if (!needle) return invoicesBj;
    return invoicesBj.filter((inv) => [inv.invoiceNo, inv.client.name, statusLabel(inv.status)].join(" ").toLowerCase().includes(needle));
  }, [invoicesBj, qBj]);

  const filteredInvoices = useMemo(() => {
    const needle = qInv.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((inv) => [inv.invoiceNo, inv.client.name, inv.period, statusLabel(inv.status)].join(" ").toLowerCase().includes(needle));
  }, [invoices, qInv]);

  return (
    <>
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Klien</div>
          <AddClientDialog />
        </div>
        <input
          type="text"
          className="input"
          placeholder="Cari nama klien, PIC..."
          value={qClient}
          onChange={(e) => setQClient(e.target.value)}
          style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
        />
        {filteredClients.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{clients.length === 0 ? "Belum ada klien." : "Tidak ada hasil."}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama klien</th>
                <th>PIC</th>
                <th>Karyawan ditempatkan</th>
                <th>Skema fee</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.pic || "-"}</td>
                  <td>{c.employees.length}</td>
                  <td>{c.feeType === "percent" ? c.feeValue + "% dari gaji" : formatRp(c.feeValue) + "/karyawan"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Invoice Barang &amp; Jasa</div>
          <AddInvoiceBjDialog clients={clients} />
        </div>
        <input
          type="text"
          className="input"
          placeholder="Cari no. invoice, klien..."
          value={qBj}
          onChange={(e) => setQBj(e.target.value)}
          style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
        />
        {filteredBj.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{invoicesBj.length === 0 ? "Belum ada invoice." : "Tidak ada hasil."}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Klien</th>
                <th>Tanggal</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredBj.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNo}</td>
                  <td>{inv.client.name}</td>
                  <td className="text-muted">{inv.date.toLocaleDateString("id-ID")}</td>
                  <td style={{ fontWeight: 600 }}>{formatRp(invoiceTotal(inv.items, inv.withPpn))}</td>
                  <td><span className={statusTag(inv.status)}>{statusLabel(inv.status)}</span></td>
                  <td><InvoiceBjActions id={inv.id} status={inv.status} /></td>
                  <td><a href={`/print/invoice-bj/${inv.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Cetak</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Tagihan Outsourcing Bulanan</div>
          <GenerateInvoiceButton />
        </div>
        <input
          type="text"
          className="input"
          placeholder="Cari no. invoice, klien, periode..."
          value={qInv}
          onChange={(e) => setQInv(e.target.value)}
          style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
        />
        {filteredInvoices.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>
            {invoices.length === 0 ? "Belum ada tagihan. Pilih periode lalu klik Generate tagihan." : "Tidak ada hasil."}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Klien</th>
                <th>Periode</th>
                <th>Gaji</th>
                <th>Fee</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNo}</td>
                  <td>{inv.client.name}</td>
                  <td className="text-muted">{inv.period}</td>
                  <td>{formatRp(inv.gajiTotal)}</td>
                  <td>{formatRp(inv.feeTotal)}</td>
                  <td style={{ fontWeight: 600 }}>{formatRp(inv.total)}</td>
                  <td><span className={statusTag(inv.status)}>{statusLabel(inv.status)}</span></td>
                  <td><InvoiceActions id={inv.id} status={inv.status} /></td>
                  <td><a href={`/print/invoice-outsourcing/${inv.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Cetak</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
