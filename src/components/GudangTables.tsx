"use client";

import { useMemo, useState, useTransition } from "react";
import type { InventoryItem, InventoryRequest } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import type { EmployeeOption } from "@/components/EmployeeCombobox";
import { AddInventoryItemDialog } from "@/components/AddInventoryItemDialog";
import { EditInventoryItemDialog } from "@/components/EditInventoryItemDialog";
import { RequestItemDialog } from "@/components/RequestItemDialog";
import { InventoryRequestDetailDialog } from "@/components/InventoryRequestDetailDialog";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { toggleInventoryItemActive, completeInventoryRequest } from "@/app/(app)/gudang/actions";
import { BASE_PATH } from "@/lib/basePath";

function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={active ? "tag tag-accent" : "tag tag-warning"}
      style={{ border: "none", cursor: pending ? "default" : "pointer" }}
      disabled={pending}
      onClick={() => startTransition(() => toggleInventoryItemActive(id, !active))}
      title={active ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
    >
      {pending ? "…" : active ? "Aktif" : "Nonaktif"}
    </button>
  );
}

const REQUEST_STATUS_TAG: Record<string, string> = {
  berjalan: "tag tag-outline",
  selesai: "tag tag-accent",
  dibatalkan: "tag tag-danger",
};
const REQUEST_STATUS_LABEL: Record<string, string> = {
  berjalan: "Berjalan",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

function ItemsTable({ title, rows, emptyLabel }: { title: string; rows: InventoryItem[]; emptyLabel: string }) {
  return (
    <>
      <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>{title}</div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{emptyLabel}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Nama barang</th>
              <th>Kategori</th>
              <th>Jenis</th>
              <th>Stok</th>
              <th>Harga satuan</th>
              <th>Nilai stok</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td className="text-muted">{i.category || "-"}</td>
                <td className="text-muted">{i.trackStock ? "Stok fisik" : "Sesuai permintaan"}</td>
                <td>
                  {i.trackStock ? (
                    <>
                      {i.qty} {i.unit}
                      {i.qty <= 2 && <span className="tag tag-outline" style={{ marginLeft: 8 }}>Menipis</span>}
                    </>
                  ) : (
                    <span className="text-muted">&mdash;</span>
                  )}
                </td>
                <td>{formatRp(i.price)}</td>
                <td style={{ fontWeight: 600 }}>{i.trackStock ? formatRp(i.qty * i.price) : <span className="text-muted" style={{ fontWeight: 400 }}>&mdash;</span>}</td>
                <td><ActiveToggle id={i.id} active={i.active} /></td>
                <td><EditInventoryItemDialog item={i} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function CompleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => { setError(""); startTransition(async () => {
        try { await completeInventoryRequest(id); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
      }); }}>
        {pending ? "…" : "Selesaikan"}
      </button>
      {error && <div style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</div>}
    </div>
  );
}

export function GudangTables({
  items,
  requests,
  employees,
  siteNames,
}: {
  items: InventoryItem[];
  requests: InventoryRequest[];
  employees: EmployeeOption[];
  siteNames: string[];
}) {
  const [qItem, setQItem] = useState("");
  const [qReq, setQReq] = useState("");

  const filteredItems = useMemo(() => {
    const needle = qItem.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => [i.name, i.category ?? ""].join(" ").toLowerCase().includes(needle));
  }, [items, qItem]);
  const filteredStockItems = useMemo(() => filteredItems.filter((i) => i.purpose !== "mbp"), [filteredItems]);
  const filteredMbpItems = useMemo(() => filteredItems.filter((i) => i.purpose === "mbp"), [filteredItems]);

  const filteredRequests = useMemo(() => {
    const needle = qReq.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((r) => [r.itemName, r.requesterName, r.department ?? ""].join(" ").toLowerCase().includes(needle));
  }, [requests, qReq]);
  const { paged: pagedRequests, page: pageReq, setPage: setPageReq, totalItems: totalReq } = usePagedRows(filteredRequests);

  const trackedItems = items.filter((i) => i.trackStock && i.purpose !== "mbp");
  const totalStockValue = trackedItems.reduce((s, i) => s + i.qty * i.price, 0);
  const lowStockCount = trackedItems.filter((i) => i.qty <= 2).length;
  const requestableItems = items.filter((i) => i.active && i.purpose !== "mbp");

  return (
    <>
      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="card"><div className="card-kicker">Jenis barang</div><div className="card-title" style={{ fontSize: 22 }}>{items.length}</div></div>
        <div className="card"><div className="card-kicker">Total nilai stok</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(totalStockValue)}</div></div>
        <div className="card"><div className="card-kicker">Stok menipis (&le;2)</div><div className="card-title" style={{ fontSize: 22 }}>{lowStockCount}</div></div>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div className="card-kicker">Barang</div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <RequestItemDialog
              items={requestableItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty, price: i.price, trackStock: i.trackStock }))}
              employees={employees}
              siteNames={siteNames}
            />
            <AddInventoryItemDialog />
          </div>
        </div>
        <input
          type="text"
          className="input"
          placeholder="Cari nama barang, kategori..."
          value={qItem}
          onChange={(e) => setQItem(e.target.value)}
          style={{ marginBottom: "var(--space-4)", width: "100%", maxWidth: 320 }}
        />

        <div style={{ marginBottom: "var(--space-6)" }}>
          <ItemsTable
            title="Stok Internal"
            rows={filteredStockItems}
            emptyLabel={items.filter((i) => i.purpose !== "mbp").length === 0 ? "Belum ada barang stok internal." : "Tidak ada hasil."}
          />
        </div>
        <div>
          <ItemsTable
            title="Barang MBP"
            rows={filteredMbpItems}
            emptyLabel={items.filter((i) => i.purpose === "mbp").length === 0 ? "Belum ada barang khusus MBP." : "Tidak ada hasil."}
          />
        </div>
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
                  <th>Status</th>
                  <th></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedRequests.map((r) => (
                  <tr key={r.id} style={r.status === "dibatalkan" ? { opacity: 0.55 } : undefined}>
                    <td className="text-muted">{r.date.toLocaleDateString("id-ID")}</td>
                    <td>{r.itemName}</td>
                    <td>{r.qty}</td>
                    <td style={{ fontWeight: 600 }}>{formatRp(r.qty * r.unitPrice)}</td>
                    <td>{r.requesterName}</td>
                    <td className="text-muted">{r.department || "-"}</td>
                    <td><span className={REQUEST_STATUS_TAG[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</span></td>
                    <td>{r.status === "berjalan" && <CompleteButton id={r.id} />}</td>
                    <td><InventoryRequestDetailDialog request={r} /></td>
                    <td><a href={`${BASE_PATH}/print/inventory-request/${r.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Cetak</a></td>
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
