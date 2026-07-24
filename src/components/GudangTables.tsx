"use client";

import { useMemo, useState } from "react";
import type { InventoryItem, InventoryRequest } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { AddInventoryItemDialog } from "@/components/AddInventoryItemDialog";
import { EditInventoryItemDialog } from "@/components/EditInventoryItemDialog";
import { RequestItemDialog } from "@/components/RequestItemDialog";
import { Pagination, usePagedRows } from "@/components/Pagination";

export function GudangTables({ items, requests }: { items: InventoryItem[]; requests: InventoryRequest[] }) {
  const [qItem, setQItem] = useState("");
  const [qReq, setQReq] = useState("");

  const filteredItems = useMemo(() => {
    const needle = qItem.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => [i.name, i.category ?? ""].join(" ").toLowerCase().includes(needle));
  }, [items, qItem]);

  const filteredRequests = useMemo(() => {
    const needle = qReq.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((r) => [r.itemName, r.requesterName, r.department ?? ""].join(" ").toLowerCase().includes(needle));
  }, [requests, qReq]);
  const { paged: pagedRequests, page: pageReq, setPage: setPageReq, totalItems: totalReq } = usePagedRows(filteredRequests);

  const totalStockValue = items.reduce((s, i) => s + i.qty * i.price, 0);
  const lowStockCount = items.filter((i) => i.qty <= 2).length;

  return (
    <>
      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="card"><div className="card-kicker">Jenis barang</div><div className="card-title" style={{ fontSize: 22 }}>{items.length}</div></div>
        <div className="card"><div className="card-kicker">Total nilai stok</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(totalStockValue)}</div></div>
        <div className="card"><div className="card-kicker">Stok menipis (&le;2)</div><div className="card-title" style={{ fontSize: 22 }}>{lowStockCount}</div></div>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div className="card-kicker">Daftar Barang</div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <RequestItemDialog items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty, price: i.price }))} />
            <AddInventoryItemDialog />
          </div>
        </div>
        <input
          type="text"
          className="input"
          placeholder="Cari nama barang, kategori..."
          value={qItem}
          onChange={(e) => setQItem(e.target.value)}
          style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
        />
        {filteredItems.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{items.length === 0 ? "Belum ada barang di gudang." : "Tidak ada hasil."}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama barang</th>
                <th>Kategori</th>
                <th>Stok</th>
                <th>Harga satuan</th>
                <th>Nilai stok</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className="text-muted">{i.category || "-"}</td>
                  <td>
                    {i.qty} {i.unit}
                    {i.qty <= 2 && <span className="tag tag-outline" style={{ marginLeft: 8 }}>Menipis</span>}
                  </td>
                  <td>{formatRp(i.price)}</td>
                  <td style={{ fontWeight: 600 }}>{formatRp(i.qty * i.price)}</td>
                  <td><EditInventoryItemDialog item={i} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Riwayat Pengambilan Barang</div>
        <input
          type="text"
          className="input"
          placeholder="Cari nama barang, peminta, departemen..."
          value={qReq}
          onChange={(e) => setQReq(e.target.value)}
          style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
        />
        {filteredRequests.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{requests.length === 0 ? "Belum ada barang yang diambil." : "Tidak ada hasil."}</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Barang</th>
                  <th>Jumlah</th>
                  <th>Total</th>
                  <th>Peminta</th>
                  <th>Departemen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted">{r.date.toLocaleDateString("id-ID")}</td>
                    <td>{r.itemName}</td>
                    <td>{r.qty}</td>
                    <td style={{ fontWeight: 600 }}>{formatRp(r.qty * r.unitPrice)}</td>
                    <td>{r.requesterName}</td>
                    <td className="text-muted">{r.department || "-"}</td>
                    <td><a href={`/print/inventory-request/${r.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Cetak</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={pageReq} totalItems={totalReq} onChange={setPageReq} />
          </>
        )}
      </div>
    </>
  );
}
