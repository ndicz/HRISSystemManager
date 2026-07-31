"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Account, CashAccount, Employee, Position, SalaryComponent, Site, Transaction } from "@prisma/client";
import { computePayroll, expiringContracts, formatRp } from "@/lib/payroll";
import { monthKey, saldoKasSampai } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Users, Clock3, Wallet, Landmark, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";

// Full-bleed gradient hero card (icon badge + label + big number) — every
// headline KPI gets one, not just 1-2, mirroring the reference's block of
// bold color cards. Alternates the app's existing orange/cool gradient
// tones (a/b) rather than the reference's own blue/purple/green.
function GradientStat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: "a" | "b" }) {
  return (
    <div className={`card stat-gradient stat-gradient-${tone}`} style={{ position: "relative", gap: 6 }}>
      <div
        className="flex size-8 items-center justify-center rounded-lg"
        style={{ background: "rgba(255,255,255,0.18)" }}
      >
        {icon}
      </div>
      <div className="card-kicker">{label}</div>
      <div className="card-title" style={{ fontSize: 22 }}>{value}</div>
      <p className="card-body" style={{ opacity: 0.85 }}>{hint}</p>
    </div>
  );
}

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
  const expiring = useMemo(() => expiringContracts(employees, 30), [employees]);
  const recentEmployees = useMemo(
    () => [...employees].sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime()).slice(0, 5),
    [employees],
  );

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
        <GradientStat
          tone="a"
          icon={<Users size={16} />}
          label="Total karyawan"
          value={String(totalKaryawan)}
          hint={`Aktif di ${totalSites} tempat kerja`}
        />
        <GradientStat
          tone="b"
          icon={<Clock3 size={16} />}
          label="Kehadiran hari ini"
          value={`${kehadiranPct}%`}
          hint={`${hadirCount} hadir dari ${totalKaryawan}`}
        />
        <GradientStat
          tone="a"
          icon={<Wallet size={16} />}
          label="Total gaji bulan ini"
          value={formatRp(totalGajiBulanIni)}
          hint="Setelah potongan BPJS & kasbon"
        />
        <GradientStat
          tone="b"
          icon={<Landmark size={16} />}
          label="Saldo kas (s.d. akhir periode)"
          value={formatRp(saldoAkhir)}
          hint={`${periodTx.length} transaksi periode ini`}
        />
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Arus Kas &mdash; {monthOptions().find((p) => p.value === period)?.label}</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>Dana masuk</span><span className="text-muted">{formatRp(sumMasuk)}</span></div>
              <div style={{ height: 12, background: "var(--color-surface)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 6, background: "var(--color-brand)", width: Math.max(2, Math.round((sumMasuk / maxArus) * 100)) + "%" }} />
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
                    <div style={{ height: "100%", borderRadius: 5, background: "var(--color-brand)", width: row.pct + "%" }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Rincian kehadiran per tempat kerja</div>
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
                <div key={t.id} className="flex items-center gap-3" style={{ borderBottom: "1px solid var(--color-divider)", paddingBottom: "var(--space-2)" }}>
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: t.type === "masuk" ? "var(--color-accent-100)" : "var(--color-neutral-100)",
                      color: t.type === "masuk" ? "var(--color-accent-700)" : "var(--color-neutral-700)",
                    }}
                  >
                    {t.type === "masuk" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <div>
                      <div style={{ fontSize: 14 }}>{t.desc}</div>
                      <div style={{ fontSize: 12, opacity: 0.55 }}>{t.date.toLocaleDateString("id-ID")} &middot; {t.account.name}</div>
                    </div>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap" }} className={t.type === "masuk" ? "text-accent" : ""}>
                      {t.type === "masuk" ? "+" : "-"}{formatRp(t.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Kontrak akan berakhir (30 hari)</div>
          {expiring.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada kontrak yang akan berakhir dalam 30 hari.</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {expiring.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", borderBottom: "1px solid var(--color-divider)", paddingBottom: "var(--space-2)" }}>
                  <div>
                    <div style={{ fontSize: 14 }}>{e.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.55 }}>{e.siteName} &middot; berakhir {e.contractEnd.toLocaleDateString("id-ID")}</div>
                  </div>
                  <span className={e.daysRemaining <= 7 ? "tag tag-accent" : "tag tag-outline"}>
                    {e.daysRemaining < 0 ? `Lewat ${Math.abs(e.daysRemaining)} hari` : e.daysRemaining === 0 ? "Hari ini" : `${e.daysRemaining} hari lagi`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Card className="p-4">
          <div className="card-kicker mb-3">Karyawan terbaru</div>
          {recentEmployees.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada karyawan aktif.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentEmployees.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={e.name} size={30} />
                    <div>
                      <div style={{ fontSize: 14 }}>{e.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.55 }}>{e.position.name}</div>
                    </div>
                  </div>
                  <span className="tag tag-blue">{e.site.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
