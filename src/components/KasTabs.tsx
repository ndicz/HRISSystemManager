"use client";

import { useMemo, useState, useTransition } from "react";
import type { Account, CashAccount, Payable, Transaction } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { laporanLabaRugi, monthKey, saldoKasSampai, saldoKasSebelum, AGING_BUCKET_ORDER, type AgingRow } from "@/lib/finance";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { EditTransactionDialog } from "@/components/EditTransactionDialog";
import { AddAccountDialog } from "@/components/AddAccountDialog";
import { EditAccountDialog } from "@/components/EditAccountDialog";
import { AddPayableDialog } from "@/components/AddPayableDialog";
import { PayableActions } from "@/components/PayableActions";
import { TransferDialog } from "@/components/TransferDialog";
import { BudgetEditButton } from "@/components/BudgetEditButton";
import { DocHandoverDateInput } from "@/components/DocHandoverDateInput";
import { closePeriod, reopenPeriod } from "@/app/(app)/kas/actions";

type Props = {
  accounts: Account[];
  cashAccounts: CashAccount[];
  transactions: (Transaction & { account: Account; cashAccount: CashAccount })[];
  payables: Payable[];
  closedPeriods: string[];
  agingRows: AgingRow[];
};

const TABS = ["transaksi", "labarugi", "neraca", "aruskas", "coa", "piutang", "hutang", "rekening", "anggaran"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  transaksi: "Transaksi",
  labarugi: "Laba Rugi",
  neraca: "Neraca",
  aruskas: "Arus Kas",
  coa: "Daftar Akun (COA)",
  piutang: "Piutang Usaha",
  hutang: "Hutang Usaha",
  rekening: "Rekening",
  anggaran: "Anggaran",
};

function monthOptions() {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names.map((n, i) => ({ value: "2026-" + String(i + 1).padStart(2, "0"), label: n + " 2026" }));
}

export function KasTabs({ accounts, cashAccounts, transactions, payables, closedPeriods, agingRows }: Props) {
  const [tab, setTab] = useState<Tab>("transaksi");
  const [period, setPeriod] = useState(() => monthKey(new Date()));
  const [qTx, setQTx] = useState("");
  const [closedList, setClosedList] = useState(closedPeriods);
  const [periodPending, startPeriodTransition] = useTransition();

  const isViewedPeriodClosed = closedList.includes(period);
  const isTodayPeriodClosed = closedList.includes(monthKey(new Date()));

  function handleClosePeriod() {
    startPeriodTransition(async () => {
      await closePeriod(period);
      setClosedList((prev) => (prev.includes(period) ? prev : [...prev, period]));
    });
  }

  function handleReopenPeriod() {
    startPeriodTransition(async () => {
      await reopenPeriod(period);
      setClosedList((prev) => prev.filter((p) => p !== period));
    });
  }

  const openingTotal = cashAccounts.reduce((s, c) => s + c.opening, 0);
  const saldoAkhir = saldoKasSampai(openingTotal, transactions, period);
  const saldoAwalPeriode = saldoKasSebelum(openingTotal, transactions, period);

  const periodTx = useMemo(() => transactions.filter((t) => monthKey(t.date) === period), [transactions, period]);
  const filteredTx = useMemo(() => {
    const needle = qTx.trim().toLowerCase();
    if (!needle) return periodTx;
    return periodTx.filter((t) => [t.account.name, t.cashAccount.name, t.desc].join(" ").toLowerCase().includes(needle));
  }, [periodTx, qTx]);
  const sumMasuk = periodTx.filter((t) => t.type === "masuk" && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const sumKeluar = periodTx.filter((t) => t.type === "keluar" && !t.isTransfer).reduce((s, t) => s + t.amount, 0);

  const lr = useMemo(() => laporanLabaRugi(accounts, transactions, period), [accounts, transactions, period]);

  const totalPiutang = agingRows.reduce((s, r) => s + r.amount, 0);
  const agingTotals = AGING_BUCKET_ORDER.map((b) => ({
    bucket: b,
    total: agingRows.filter((r) => r.bucket === b).reduce((s, r) => s + r.amount, 0),
  }));

  const totalAset = saldoAkhir + totalPiutang;

  const cashAccountBalance = (id: string) => {
    const acc = cashAccounts.find((c) => c.id === id);
    if (!acc) return 0;
    return (
      acc.opening +
      transactions.filter((t) => t.cashAccountId === id).reduce((s, t) => s + (t.type === "masuk" ? t.amount : -t.amount), 0)
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label htmlFor="period">Periode</label>
          <select className="input" id="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {monthOptions().map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {!isViewedPeriodClosed && (
          <button type="button" className="btn btn-secondary" disabled={periodPending} onClick={handleClosePeriod}>
            Tutup periode
          </button>
        )}
      </div>

      {isViewedPeriodClosed && (
        <div className="card" style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div>
            <span className="tag tag-neutral" style={{ marginRight: "var(--space-2)" }}>Periode Ditutup</span>
            <span style={{ fontSize: 13, opacity: 0.75 }}>
              Periode {monthOptions().find((p) => p.value === period)?.label} sudah ditutup — pencatatan transaksi baru untuk periode ini dikunci.
            </span>
          </div>
          <button type="button" className="btn btn-secondary" disabled={periodPending} onClick={handleReopenPeriod}>
            Buka kembali
          </button>
        </div>
      )}

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card"><div className="card-kicker">Saldo kas (s.d. akhir periode)</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(saldoAkhir)}</div></div>
        <div className="card"><div className="card-kicker">Dana masuk periode ini</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumMasuk)}</div></div>
        <div className="card"><div className="card-kicker">Dana keluar periode ini</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumKeluar)}</div></div>
        <div className="card"><div className="card-kicker">Total piutang belum lunas</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(totalPiutang)}</div></div>
      </div>

      <div className="seg" role="radiogroup" style={{ width: "fit-content", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <label key={t} className="seg-opt">
            <input type="radio" name="kastab" checked={tab === t} onChange={() => setTab(t)} />
            {TAB_LABEL[t]}
          </label>
        ))}
      </div>

      {tab === "transaksi" && (
        <>
          <input
            type="text"
            className="input"
            placeholder="Cari akun, rekening, keterangan..."
            value={qTx}
            onChange={(e) => setQTx(e.target.value)}
            style={{ width: "100%", maxWidth: 280, marginBottom: "var(--space-4)" }}
          />
          {(["kecil", "besar"] as const).map((kind) => {
            const kindAccounts = cashAccounts.filter((c) => c.kind === kind);
            const kindTx = filteredTx.filter((t) => t.cashAccount.kind === kind);
            return (
              <div key={kind} style={{ marginBottom: "var(--space-6)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  <div className="card-kicker">Transaksi Kas {kind === "kecil" ? "Kecil" : "Besar"}</div>
                  <AddTransactionDialog accounts={accounts} cashAccounts={kindAccounts} disabled={isTodayPeriodClosed} />
                </div>
                <div className="card">
                  {kindTx.length === 0 ? (
                    <p style={{ fontSize: 13, opacity: 0.6 }}>{periodTx.filter((t) => t.cashAccount.kind === kind).length === 0 ? "Belum ada transaksi periode ini." : "Tidak ada hasil."}</p>
                  ) : (
                    <table className="table">
                      <thead><tr><th>Tanggal</th><th>Akun</th><th>Rekening</th><th>Keterangan</th><th>Jumlah</th><th>Lampiran</th><th></th></tr></thead>
                      <tbody>
                        {kindTx.map((t) => (
                          <tr key={t.id}>
                            <td className="text-muted">{t.date.toLocaleDateString("id-ID")}</td>
                            <td>{t.account.code} · {t.account.name}</td>
                            <td>{t.cashAccount.name}</td>
                            <td>{t.desc}</td>
                            <td className={t.type === "masuk" ? "text-accent" : ""}>{t.type === "masuk" ? "+" : "-"}{formatRp(t.amount)}</td>
                            <td>
                              {t.attachmentUrl ? (
                                <a href={t.attachmentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Lihat</a>
                              ) : "-"}
                            </td>
                            <td>
                              {!t.isTransfer && (
                                <EditTransactionDialog tx={t} accounts={accounts} cashAccounts={cashAccounts} disabled={closedList.includes(monthKey(t.date))} />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "labarugi" && (
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Laporan Laba Rugi</div>
          <table className="table">
            <thead><tr><th>Akun</th><th style={{ textAlign: "right" }}>Jumlah</th></tr></thead>
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>Pendapatan</td><td></td></tr>
              {lr.pendapatanRows.map((r) => (
                <tr key={r.account.id}><td className="text-muted" style={{ paddingLeft: 20 }}>{r.account.code} · {r.account.name}</td><td style={{ textAlign: "right" }}>{formatRp(r.amt)}</td></tr>
              ))}
              <tr><td style={{ fontWeight: 600, borderTop: "1px solid var(--color-divider)" }}>Total Pendapatan</td><td style={{ textAlign: "right", fontWeight: 600, borderTop: "1px solid var(--color-divider)" }}>{formatRp(lr.totalPendapatan)}</td></tr>
              <tr><td style={{ fontWeight: 600, paddingTop: 12 }}>Beban Operasional</td><td></td></tr>
              {lr.bebanRows.map((r) => (
                <tr key={r.account.id}><td className="text-muted" style={{ paddingLeft: 20 }}>{r.account.code} · {r.account.name}</td><td style={{ textAlign: "right" }}>{formatRp(r.amt)}</td></tr>
              ))}
              <tr><td style={{ fontWeight: 600, borderTop: "1px solid var(--color-divider)" }}>Total Beban</td><td style={{ textAlign: "right", fontWeight: 600, borderTop: "1px solid var(--color-divider)" }}>{formatRp(lr.totalBeban)}</td></tr>
              <tr>
                <td style={{ fontWeight: 700, fontSize: 16, borderTop: "2px solid var(--color-text)", paddingTop: 12 }}>{lr.labaRugi >= 0 ? "Laba Bersih" : "Rugi Bersih"}</td>
                <td style={{ textAlign: "right", fontWeight: 700, fontSize: 16, borderTop: "2px solid var(--color-text)", paddingTop: 12 }}>{formatRp(Math.abs(lr.labaRugi))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "neraca" && (
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Neraca (per akhir periode)</div>
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>Aset</td><td></td></tr>
              <tr><td className="text-muted" style={{ paddingLeft: 20 }}>Kas &amp; Setara Kas</td><td style={{ textAlign: "right" }}>{formatRp(saldoAkhir)}</td></tr>
              <tr><td className="text-muted" style={{ paddingLeft: 20 }}>Piutang Usaha</td><td style={{ textAlign: "right" }}>{formatRp(totalPiutang)}</td></tr>
              <tr><td style={{ fontWeight: 600, borderTop: "1px solid var(--color-divider)" }}>Total Aset</td><td style={{ textAlign: "right", fontWeight: 600, borderTop: "1px solid var(--color-divider)" }}>{formatRp(totalAset)}</td></tr>
              <tr><td style={{ fontWeight: 600, paddingTop: 12 }}>Liabilitas</td><td></td></tr>
              <tr><td className="text-muted" style={{ paddingLeft: 20 }}>Tidak ada liabilitas tercatat</td><td style={{ textAlign: "right" }}>{formatRp(0)}</td></tr>
              <tr><td style={{ fontWeight: 600, paddingTop: 12 }}>Ekuitas</td><td></td></tr>
              <tr><td className="text-muted" style={{ paddingLeft: 20 }}>Modal &amp; Laba Ditahan</td><td style={{ textAlign: "right" }}>{formatRp(totalAset)}</td></tr>
              <tr><td style={{ fontWeight: 700, fontSize: 16, borderTop: "2px solid var(--color-text)", paddingTop: 12 }}>Total Liabilitas &amp; Ekuitas</td><td style={{ textAlign: "right", fontWeight: 700, fontSize: 16, borderTop: "2px solid var(--color-text)", paddingTop: 12 }}>{formatRp(totalAset)}</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, opacity: 0.55, marginTop: 12 }}>Ekuitas dihitung sebagai angka penyeimbang, bukan pencatatan modal sesungguhnya.</p>
        </div>
      )}

      {tab === "aruskas" && (
        <div className="card">
          <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>Laporan Arus Kas</div>
          <table className="table">
            <tbody>
              <tr><td>Saldo kas awal periode</td><td style={{ textAlign: "right" }}>{formatRp(saldoAwalPeriode)}</td></tr>
              <tr><td className="text-muted" style={{ paddingLeft: 20 }}>Penerimaan</td><td style={{ textAlign: "right" }}>{formatRp(sumMasuk)}</td></tr>
              <tr><td className="text-muted" style={{ paddingLeft: 20 }}>Pembayaran beban</td><td style={{ textAlign: "right" }}>-{formatRp(sumKeluar)}</td></tr>
              <tr><td style={{ fontWeight: 700, fontSize: 16, borderTop: "2px solid var(--color-text)", paddingTop: 12 }}>Saldo kas akhir periode</td><td style={{ textAlign: "right", fontWeight: 700, fontSize: 16, borderTop: "2px solid var(--color-text)", paddingTop: 12 }}>{formatRp(saldoAkhir)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "piutang" && (
        <>
          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
            {agingTotals.map((b) => (
              <div key={b.bucket} className="card" style={{ padding: "var(--space-3)" }}>
                <div className="card-kicker" style={{ fontSize: 11 }}>{b.bucket}</div>
                <div style={{ fontWeight: 600 }}>{formatRp(b.total)}</div>
              </div>
            ))}
          </div>
          <div className="card">
            {agingRows.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.6 }}>Tidak ada piutang tertunggak.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Sumber</th>
                    <th>Jatuh tempo</th>
                    <th>Tgl. penyerahan dokumen</th>
                    <th>Jumlah</th>
                    <th>Umur</th>
                  </tr>
                </thead>
                <tbody>
                  {agingRows.map((r) => (
                    <tr key={r.type + r.id}>
                      <td>{r.name}</td>
                      <td className="text-muted">{r.source}</td>
                      <td className="text-muted">{r.dueDate.toLocaleDateString("id-ID")}</td>
                      <td><DocHandoverDateInput type={r.type} id={r.id} value={r.docHandoverDate} /></td>
                      <td style={{ fontWeight: 600 }}>{formatRp(r.amount)}</td>
                      <td><span className={r.bucket === "Belum jatuh tempo" ? "tag tag-accent" : "tag tag-neutral"}>{r.bucket}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "coa" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}><AddAccountDialog /></div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th></th></tr></thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="text-muted">{a.code}</td>
                    <td>{a.name}</td>
                    <td><span className={a.type === "masuk" ? "tag tag-accent" : "tag tag-neutral"}>{a.type === "masuk" ? "Pendapatan" : "Beban"}</span></td>
                    <td><EditAccountDialog account={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "hutang" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}><AddPayableDialog /></div>
          <div className="card">
            {payables.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada hutang tercatat.</p> : (
              <table className="table">
                <thead><tr><th>Vendor</th><th>Keterangan</th><th>Jatuh tempo</th><th>Jumlah</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {payables.map((p) => (
                    <tr key={p.id}>
                      <td>{p.vendorName}</td><td>{p.desc}</td>
                      <td className="text-muted">{p.dueDate.toLocaleDateString("id-ID")}</td>
                      <td>{formatRp(p.amount)}</td>
                      <td><span className={p.status === "lunas" ? "tag tag-accent" : "tag tag-outline"}>{p.status === "lunas" ? "Lunas" : "Belum dibayar"}</span></td>
                      <td><PayableActions id={p.id} disabled={p.status === "lunas" || isTodayPeriodClosed} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "rekening" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}><TransferDialog cashAccounts={cashAccounts} disabled={isTodayPeriodClosed} /></div>
          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)" }}>
            {cashAccounts.map((c) => (
              <div className="card" key={c.id}>
                <div className="card-kicker">{c.name}</div>
                <div className="card-title" style={{ fontSize: 20 }}>{formatRp(cashAccountBalance(c.id))}</div>
                <p className="card-body">Saldo awal {formatRp(c.opening)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "anggaran" && (
        <div className="card">
          <div style={{ display: "grid", gap: 16 }}>
            {accounts.filter((a) => a.type === "keluar").map((a) => {
              const realisasi = periodTx.filter((t) => t.accountCoaId === a.id && t.type === "keluar").reduce((s, t) => s + t.amount, 0);
              const budget = a.budget ?? 0;
              const pct = budget > 0 ? Math.round((realisasi / budget) * 100) : 0;
              return (
                <div key={a.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 12 }} className={pct >= 100 ? "text-muted" : ""}>{formatRp(realisasi)} / {formatRp(budget)} ({pct}%)</span>
                      <BudgetEditButton accountId={a.id} current={budget} accountName={a.name} />
                    </span>
                  </div>
                  <div style={{ height: 12, background: "var(--color-surface)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 6, background: pct >= 100 ? "var(--color-neutral-800)" : "var(--color-accent)", width: Math.min(100, pct) + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
