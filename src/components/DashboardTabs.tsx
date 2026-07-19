"use client";

import { useMemo, useState } from "react";
import type { Account, CashAccount, Employee, Position, SalaryComponent, Site, Transaction } from "@prisma/client";
import { computePayroll, formatRp } from "@/lib/payroll";
import { monthKey, saldoKasSampai } from "@/lib/finance";

type Emp = Employee & { site: Site; position: Position; salaryComponents: SalaryComponent[] };
type Tx = Transaction & { account: Account };

function monthOptions() {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const year = new Date().getFullYear();
  return names.map((n, i) => ({ value: year + "-" + String(i + 1).padStart(2, "0"), label: n + " " + year }));
}

export function DashboardTabs({
  employees,
  sites,
  cashAccounts,
  transactions,
}: {
  employees: Emp[];
  sites: Site[];
  cashAccounts: CashAccount[];
  transactions: Tx[];
}) {
  const [period, setPeriod] = useState(() => monthKey(new Date()));

  const totalKaryawan = employees.length;
  const totalSites = sites.length;
  const hadirCount = employees.filter((e) => e.attStatus === "Hadir").length;
  const kehadiranPct = totalKaryawan > 0 ? ((hadirCount / totalKaryawan) * 100).toFixed(1) : "0.0";

  const totalGajiBulanIni = useMemo(
    () => employees.reduce((s, e) => s + computePayroll(e, e.salaryComponents).total, 0),
    [employees],
  );

  const openingTotal = cashAccounts.reduce((s, c) => s + c.opening, 0);
  const saldoAkhir = saldoKasSampai(openingTotal, transactions, period);

  const periodTx = useMemo(() => transactions.filter((t) => monthKey(t.date) === period), [transactions, period]);
  const sumMasuk = periodTx.filter((t) => t.type === "masuk" && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const sumKeluar = periodTx.filter((t) => t.type === "keluar" && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const maxArus = Math.max(sumMasuk, sumKeluar, 1);

  const siteStats = sites.map((s) => {
    const emps = employees.filter((e) => e.siteId === s.id);
    const hadir = emps.filter((e) => e.attStatus === "Hadir").length;
    const izin = emps.filter((e) => e.attStatus === "Izin").length;
    const alpha = emps.filter((e) => e.attStatus === "Alpha").length;
    return { site: s, total: emps.length, hadir, izin, alpha, pct: emps.length > 0 ? Math.max(2, Math.round((hadir / emps.length) * 100)) : 2 };
  });

  const recentTx = transactions.slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label htmlFor="dash-period">Periode</label>
          <select className="input" id="dash-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {monthOptions().map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="card">
          <div className="card-kicker">Total karyawan</div>
          <div className="card-title">{totalKaryawan}</div>
          <p className="card-body">Aktif di {totalSites} tempat kerja</p>
        </div>
        <div className="card">
          <div className="card-kicker">Kehadiran hari ini</div>
          <div className="card-title">{kehadiranPct}%</div>
          <p className="card-body">{hadirCount} hadir dari {totalKaryawan}</p>
        </div>
        <div className="card">
          <div className="card-kicker">Total gaji bulan ini</div>
          <div className="card-title" style={{ fontSize: 22 }}>{formatRp(totalGajiBulanIni)}</div>
          <p className="card-body">Setelah potongan BPJS &amp; kasbon</p>
        </div>
        <div className="card">
          <div className="card-kicker">Saldo kas (s.d. akhir periode)</div>
          <div className="card-title" style={{ fontSize: 22 }}>{formatRp(saldoAkhir)}</div>
          <p className="card-body">{periodTx.length} transaksi periode ini</p>
        </div>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Arus Kas &mdash; {monthOptions().find((p) => p.value === period)?.label}</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>Dana masuk</span><span className="text-muted">{formatRp(sumMasuk)}</span></div>
              <div style={{ height: 12, background: "var(--color-surface)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 6, background: "var(--color-accent)", width: Math.max(2, Math.round((sumMasuk / maxArus) * 100)) + "%" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>Dana keluar</span><span className="text-muted">{formatRp(sumKeluar)}</span></div>
              <div style={{ height: 12, background: "var(--color-surface)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 6, background: "var(--color-neutral-800)", width: Math.max(2, Math.round((sumKeluar / maxArus) * 100)) + "%" }} />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Kehadiran per tempat kerja</div>
          <div style={{ display: "grid", gap: 12 }}>
            {siteStats.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada tempat kerja.</p>
            ) : (
              siteStats.map((row) => (
                <div key={row.site.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{row.site.name}</span><span className="text-muted">{row.hadir}/{row.total} hadir</span></div>
                  <div style={{ height: 10, background: "var(--color-surface)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 5, background: "var(--color-accent)", width: row.pct + "%" }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Kehadiran per tempat kerja</div>
          <table className="table">
            <thead><tr><th>Tempat kerja</th><th>Karyawan</th><th>Hadir</th><th>Izin</th><th>Alpha</th></tr></thead>
            <tbody>
              {siteStats.map((row) => (
                <tr key={row.site.id}>
                  <td>{row.site.name}</td>
                  <td>{row.total}</td>
                  <td>{row.hadir}</td>
                  <td>{row.izin}</td>
                  <td>{row.alpha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Transaksi kas terbaru</div>
          {recentTx.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada transaksi tercatat.</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {recentTx.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", borderBottom: "1px solid var(--color-divider)", paddingBottom: "var(--space-2)" }}>
                  <div>
                    <div style={{ fontSize: 14 }}>{t.desc}</div>
                    <div style={{ fontSize: 12, opacity: 0.55 }}>{t.date.toLocaleDateString("id-ID")} &middot; {t.account.name}</div>
                  </div>
                  <div style={{ fontSize: 14, whiteSpace: "nowrap" }} className={t.type === "masuk" ? "text-accent" : ""}>
                    {t.type === "masuk" ? "+" : "-"}{formatRp(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
