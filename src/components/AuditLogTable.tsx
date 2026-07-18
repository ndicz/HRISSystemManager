"use client";

import { useMemo, useState } from "react";

type Row = {
  id: string;
  createdAt: Date;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Login",
  "attendance.set": "Ubah status absensi",
  "employee.create": "Tambah karyawan",
  "site.create": "Tambah tempat kerja",
  "candidate.activate": "Aktivasi kandidat jadi karyawan",
  "leave.disetujui": "Setujui cuti",
  "leave.ditolak": "Tolak cuti",
  "thr.pay": "Bayar THR",
  "transaction.create": "Catat transaksi kas",
  "invoiceBj.create": "Buat invoice barang & jasa",
  "invoice.generate": "Generate tagihan outsourcing",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatDetail(detail: string | null) {
  if (!detail) return "-";
  try {
    const parsed = JSON.parse(detail);
    return Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(", ");
  } catch {
    return detail;
  }
}

export function AuditLogTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (!needle) return true;
      return [r.userName, actionLabel(r.action), r.entity, r.entityId ?? "", formatDetail(r.detail)].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, action]);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <input
          type="text"
          className="input"
          placeholder="Cari pengguna, aksi, entitas..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 320 }}
        />
        <select className="input" value={action} onChange={(e) => setAction(e.target.value)} style={{ width: "100%", maxWidth: 220 }}>
          <option value="all">Semua aksi</option>
          {actions.map((a) => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{rows.length === 0 ? "Belum ada aktivitas tercatat." : "Tidak ada hasil."}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Aksi</th>
              <th>Entitas</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="text-muted">{r.createdAt.toLocaleString("id-ID")}</td>
                <td>{r.userName}</td>
                <td><span className="tag tag-outline">{actionLabel(r.action)}</span></td>
                <td className="text-muted">{r.entity}{r.entityId ? " · " + r.entityId.slice(0, 8) : ""}</td>
                <td>{formatDetail(r.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
