"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord, Employee, Site, Position, SalaryComponent, PayrollRate, PayrollEntry, AllowancePayment, OvertimeDay, Assignment } from "@prisma/client";
import { bestAttendanceMonth, computeMonthlyPayroll, computeThr, formatRp, resolvePayrollRate, resolvePayrollEntry, resolveOvertimeDays, resolveAssignments } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { buildBcaTransferSheet } from "@/lib/bankTransfer";
import { downloadXlsx } from "@/lib/xlsx-writer";
import { ThrButton } from "@/components/ThrButton";
import { PayrollRateDialog } from "@/components/PayrollRateDialog";
import { PayAllowanceDialog } from "@/components/PayAllowanceDialog";
import { PayGajiButton } from "@/components/PayGajiButton";
import { PayrollDetailDialog } from "@/components/PayrollDetailDialog";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type Emp = Employee & {
  site: Site;
  position: Position;
  salaryComponents: SalaryComponent[];
  attendance: Pick<AttendanceRecord, "date" | "status" | "lateMin">[];
  payrollEntries: PayrollEntry[];
  allowancePayments: AllowancePayment[];
  overtimeDays: OvertimeDay[];
  assignments: Pick<Assignment, "cost" | "status" | "period">[];
};

type SiteOption = { id: string; name: string };

function monthOptions() {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names.map((n, i) => ({ value: "2026-" + String(i + 1).padStart(2, "0"), label: n + " 2026" }));
}

export function PenggajianTabs({ employees, rates, sites }: { employees: Emp[]; rates: PayrollRate[]; sites: SiteOption[] }) {
  const [tab, setTab] = useState<"gaji" | "thr" | "insentif">("gaji");
  const [q, setQ] = useState("");
  // Default to whichever month actually has attendance data across all
  // employees, rather than today's real calendar month (usually empty
  // right after an import).
  const [period, setPeriod] = useState(
    () => bestAttendanceMonth(employees.flatMap((e) => e.attendance)) ?? monthKey(new Date()),
  );

  const [siteFilter, setSiteFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const positionOptions = useMemo(() => [...new Set(employees.map((e) => e.position.name))].sort(), [employees]);

  const needle = q.trim().toLowerCase();
  const filteredEmployees = useMemo(
    () => employees.filter((e) => {
      if (siteFilter && e.siteId !== siteFilter) return false;
      if (positionFilter && e.position.name !== positionFilter) return false;
      if (needle && ![e.empCode, e.name, e.site.name].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    }),
    [employees, needle, siteFilter, positionFilter],
  );

  // A PayrollRate configured for the period (default and/or per-site
  // override) switches the whole table to the flat-rate breakdown; without
  // one, every row falls back to the legacy proportional calculation.
  const periodHasRate = rates.some((r) => r.period === period);

  const payrollRows = filteredEmployees.map((e) => {
    const rate = resolvePayrollRate(rates, period, e.siteId);
    const entry = resolvePayrollEntry(e.payrollEntries, period);
    const overtimeDays = resolveOvertimeDays(e.overtimeDays, period);
    const assignments = resolveAssignments(e.assignments, period);
    return { e, entry, p: computeMonthlyPayroll(e, e.salaryComponents, e.attendance, period, { rate, entry, overtimeDays, assignments }) };
  });
  const totals = payrollRows.reduce(
    (acc, r) => ({
      gajiPokok: acc.gajiPokok + r.p.gajiPokok,
      lembur: acc.lembur + r.p.lembur,
      potongan: acc.potongan + r.p.potongan,
      penugasanTambahan: acc.penugasanTambahan + r.p.penugasanTambahan,
      total: acc.total + r.p.total,
    }),
    { gajiPokok: 0, lembur: 0, potongan: 0, penugasanTambahan: 0, total: 0 },
  );
  const unpaidRows = payrollRows.filter((r) => !r.entry?.paid);
  const unpaidTotal = unpaidRows.reduce((s, r) => s + r.p.total, 0);

  // Manual pick — separate from "Bayar Gaji (semua belum dibayar)"/batch
  // per site, for cases where HR only wants to pay a specific handful of
  // people right now (e.g. correcting one person, or an off-cycle partial
  // run) rather than everyone unpaid.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const selectedRows = payrollRows.filter((r) => selectedIds.has(r.e.id));
  const selectedTotal = selectedRows.reduce((s, r) => s + r.p.total, 0);
  // Select-all covers every row currently shown, paid or not — paying a
  // mixed selection is safe since bayarGaji skips anyone already paid, and
  // printing slips for already-paid employees is the whole point of this
  // control (batch-reprinting a site that's fully paid, for example).
  const selectableIds = payrollRows.map((r) => r.e.id);
  const allSelectableSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  function toggleSelectAll() {
    setSelectedIds(allSelectableSelected ? new Set() : new Set(selectableIds));
  }

  const { sorted: sortedPayrollRows, sortKey: gajiSortKey, sortDir: gajiSortDir, toggleSort: toggleGajiSort } = useSortableRows(payrollRows, (r, key) => {
    if (key === "empCode") return r.e.empCode;
    if (key === "name") return r.e.name;
    return null;
  });

  const sitesInRowsMap = new Map<string, { siteName: string; rows: typeof payrollRows }>();
  for (const row of sortedPayrollRows) {
    const key = row.e.site.id;
    if (!sitesInRowsMap.has(key)) sitesInRowsMap.set(key, { siteName: row.e.site.name, rows: [] });
    sitesInRowsMap.get(key)!.rows.push(row);
  }
  const sitesInRows = [...sitesInRowsMap.values()].sort((a, b) => a.siteName.localeCompare(b.siteName));

  const bankReadyRows = payrollRows.filter((r) => r.e.bankAccount);
  const bankMissingCount = payrollRows.length - bankReadyRows.length;

  function downloadBankTransfer() {
    const sheet = buildBcaTransferSheet(
      bankReadyRows.map((r) => ({ empCode: r.e.empCode, name: r.e.name, bankName: r.e.bankName, bankAccount: r.e.bankAccount, amount: r.p.total })),
      period,
    );
    downloadXlsx(`transfer-bank-payroll-${period}.xlsx`, sheet);
  }

  const thrRows = filteredEmployees.map((e) => ({ e, t: computeThr(e, e.salaryComponents) }));
  const sumThr = thrRows.reduce((s, r) => s + r.t.thr, 0);
  const sumThrDibayar = thrRows.filter((r) => r.e.thrPaid).reduce((s, r) => s + r.t.thr, 0);

  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name, empCode: e.empCode }));
  const allowanceRows = filteredEmployees
    .flatMap((e) => e.allowancePayments.map((p) => ({ ...p, empName: e.name })))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const sumAllowance = allowanceRows.reduce((s, p) => s + p.amount, 0);

  const { sorted: sortedThr, sortKey: thrSortKey, sortDir: thrSortDir, toggleSort: toggleThrSort } = useSortableRows(thrRows, (r, key) => {
    if (key === "name") return r.e.name;
    return null;
  });
  const { paged: pagedThr, page: pageThr, setPage: setPageThr, totalItems: totalThr } = usePagedRows(sortedThr);

  const { sorted: sortedAllowance, sortKey: allowanceSortKey, sortDir: allowanceSortDir, toggleSort: toggleAllowanceSort } = useSortableRows(allowanceRows, (p, key) => {
    if (key === "empName") return p.empName;
    if (key === "date") return p.date;
    return null;
  });
  const { paged: pagedAllowance, page: pageAllowance, setPage: setPageAllowance, totalItems: totalAllowance } = usePagedRows(sortedAllowance);

  return (
    <div>
      <div className="seg" role="radiogroup" style={{ width: "fit-content", marginBottom: "var(--space-3)" }}>
        <label className="seg-opt"><input type="radio" checked={tab === "gaji"} onChange={() => setTab("gaji")} /> Gaji Bulanan</label>
        <label className="seg-opt"><input type="radio" checked={tab === "thr"} onChange={() => setTab("thr")} /> THR</label>
        <label className="seg-opt"><input type="radio" checked={tab === "insentif"} onChange={() => setTab("insentif")} /> Insentif/Bonus</label>
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <input
          type="text"
          className="input"
          placeholder="Cari nama, ID, tempat kerja..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 220 }}
        />
        <select className="input" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Semua tempat kerja</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Semua posisi</option>
          {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {tab === "gaji" && (
        <>
          <div style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
                <label htmlFor="gaji-period">Periode</label>
                <select className="input" id="gaji-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {monthOptions().map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={filteredEmployees.length === 0}
                  onClick={() => window.open(`/print/slip-batch?ids=${filteredEmployees.map((e) => e.id).join(",")}&period=${period}`, "_blank")}
                >
                  Cetak slip ({filteredEmployees.length})
                </button>
                <button type="button" className="btn btn-secondary" disabled={bankReadyRows.length === 0} onClick={downloadBankTransfer}>
                  Transfer bank
                </button>
                <PayrollRateDialog period={period} sites={sites} rates={rates} />
                <PayGajiButton
                  employeeIds={unpaidRows.map((r) => r.e.id)}
                  period={period}
                  totalAmount={unpaidTotal}
                  label={`Bayar Gaji (${unpaidRows.length} belum dibayar)`}
                  onPaid={() => setSelectedIds(new Set())}
                />
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div
                className="card"
                style={{
                  padding: "var(--space-3)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} karyawan dipilih</span>
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.open(`/print/slip-batch?ids=${selectedRows.map((r) => r.e.id).join(",")}&period=${period}`, "_blank")}
                  >
                    Cetak Slip Terpilih
                  </button>
                  <PayGajiButton
                    employeeIds={selectedRows.map((r) => r.e.id)}
                    period={period}
                    totalAmount={selectedTotal}
                    label="Bayar Gaji Terpilih"
                    onPaid={() => setSelectedIds(new Set())}
                  />
                </div>
              </div>
            )}
            {(siteFilter || positionFilter) && (
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: "var(--space-2)", marginBottom: 0 }}>
                &quot;Cetak slip&quot; dan &quot;Bayar Gaji&quot; di atas mengikuti filter tempat kerja/posisi yang sedang aktif.
              </p>
            )}
          </div>

          {bankMissingCount > 0 && (
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0, marginBottom: "var(--space-3)" }}>
              {bankMissingCount} karyawan belum punya nomor rekening (isi lewat dialog &quot;Profil&quot; di halaman Karyawan) — dilewati dari file transfer bank.
            </p>
          )}

          {!periodHasRate && (
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0, marginBottom: "var(--space-3)" }}>
              Belum ada tarif potongan/lembur untuk periode ini — potongan absensi dihitung proporsional dari gaji pokok seperti biasa. Klik &quot;Atur tarif&quot; untuk beralih ke potongan Izin/Alfa/Terlambat bernominal tetap.
            </p>
          )}

          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="card"><div className="card-kicker">Gaji pokok</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.gajiPokok)}</div></div>
            <div className="card"><div className="card-kicker">Lembur</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.lembur)}</div></div>
            <div className="card"><div className="card-kicker">Potongan</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.potongan)}</div></div>
            <div className="card"><div className="card-kicker">Penugasan tambahan</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.penugasanTambahan)}</div></div>
            <div className="card"><div className="card-kicker">Total dibayar</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.total)}</div></div>
          </div>
          <div className="card">
            {payrollRows.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p> : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        checked={allSelectableSelected}
                        onChange={toggleSelectAll}
                        title="Pilih semua"
                      />
                    </th>
                    <SortableTh label="ID" sortKey="empCode" activeKey={gajiSortKey} dir={gajiSortDir} onSort={toggleGajiSort} />
                    <SortableTh label="Nama" sortKey="name" activeKey={gajiSortKey} dir={gajiSortDir} onSort={toggleGajiSort} />
                    <th>Pokok</th><th>Lembur</th><th>Potongan</th><th>Penugasan</th><th>Total</th><th>Status</th><th></th><th></th>
                  </tr>
                </thead>
                {sitesInRows.map(({ siteName, rows }) => {
                  const siteTotals = rows.reduce(
                    (acc, r) => ({
                      gajiPokok: acc.gajiPokok + r.p.gajiPokok,
                      lembur: acc.lembur + r.p.lembur,
                      penugasanTambahan: acc.penugasanTambahan + r.p.penugasanTambahan,
                      potongan: acc.potongan + r.p.potongan,
                      total: acc.total + r.p.total,
                    }),
                    { gajiPokok: 0, lembur: 0, penugasanTambahan: 0, potongan: 0, total: 0 },
                  );
                  const siteUnpaidIds = rows.filter((r) => !r.entry?.paid).map((r) => r.e.id);
                  const siteUnpaidTotal = rows.filter((r) => !r.entry?.paid).reduce((s, r) => s + r.p.total, 0);
                  // Checkbox select-all for this site covers every row here
                  // (paid or not) — same reasoning as the global select-all.
                  const siteAllIds = rows.map((r) => r.e.id);
                  const siteAllSelected = siteAllIds.length > 0 && siteAllIds.every((id) => selectedIds.has(id));
                  function toggleSelectSite() {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (siteAllSelected) siteAllIds.forEach((id) => next.delete(id));
                      else siteAllIds.forEach((id) => next.add(id));
                      return next;
                    });
                  }
                  return (
                    <tbody key={siteName}>
                      <tr>
                        <td style={{ fontWeight: 600, background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                          <input
                            type="checkbox"
                            checked={siteAllSelected}
                            onChange={toggleSelectSite}
                            title={`Pilih semua di ${siteName}`}
                          />
                        </td>
                        <td colSpan={9} style={{ fontWeight: 600, background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            {siteName}
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                              <PayGajiButton
                                employeeIds={siteUnpaidIds}
                                period={period}
                                totalAmount={siteUnpaidTotal}
                                label={`Bayar gaji ${siteName} (${siteUnpaidIds.length} belum dibayar)`}
                              />
                              <a
                                href={`/print/slip-batch?ids=${rows.map((r) => r.e.id).join(",")}&period=${period}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost"
                                style={{ fontWeight: 400 }}
                              >
                                Cetak slip {siteName}
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {rows.map(({ e, p, entry }) => {
                        const overtimeDays = resolveOvertimeDays(e.overtimeDays, period);
                        return (
                        <tr key={e.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(e.id)}
                              onChange={() => toggleSelect(e.id)}
                            />
                          </td>
                          <td className="text-muted">{e.empCode}</td><td>{e.name}</td>
                          <td>{formatRp(p.gajiPokok)}</td>
                          <td>{formatRp(p.lembur)}</td>
                          <td>-{formatRp(p.potongan)}</td>
                          <td>{formatRp(p.penugasanTambahan)}</td>
                          <td style={{ fontWeight: 600 }}>{formatRp(p.total)}</td>
                          <td>
                            {entry?.paid ? <span className="tag tag-accent">✓ Dibayar</span> : <span className="tag tag-outline">Belum dibayar</span>}
                          </td>
                          <td>
                            <PayrollDetailDialog
                              employeeId={e.id}
                              employeeName={e.name}
                              period={period}
                              p={p}
                              entry={entry}
                              overtimeDays={overtimeDays}
                              bpjsKesehatanOverride={e.bpjsKesehatanOverride}
                              bpjsKetenagakerjaanOverride={e.bpjsKetenagakerjaanOverride}
                            />
                          </td>
                          <td><a href={`/print/slip/${e.id}?period=${period}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Cetak slip</a></td>
                        </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 600 }}>Subtotal {siteName}</td>
                        <td style={{ fontWeight: 600 }}>{formatRp(siteTotals.gajiPokok)}</td>
                        <td style={{ fontWeight: 600 }}>{formatRp(siteTotals.lembur)}</td>
                        <td style={{ fontWeight: 600 }}>-{formatRp(siteTotals.potongan)}</td>
                        <td style={{ fontWeight: 600 }}>{formatRp(siteTotals.penugasanTambahan)}</td>
                        <td style={{ fontWeight: 600 }}>{formatRp(siteTotals.total)}</td>
                        <td></td><td></td><td></td>
                      </tr>
                    </tbody>
                  );
                })}
                <tbody>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700 }}>Grand Total (Semua Tempat Kerja)</td>
                    <td style={{ fontWeight: 700 }}>{formatRp(totals.gajiPokok)}</td>
                    <td style={{ fontWeight: 700 }}>{formatRp(totals.lembur)}</td>
                    <td style={{ fontWeight: 700 }}>-{formatRp(totals.potongan)}</td>
                    <td style={{ fontWeight: 700 }}>{formatRp(totals.penugasanTambahan)}</td>
                    <td style={{ fontWeight: 700, background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}>{formatRp(totals.total)}</td>
                    <td></td><td></td><td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "thr" && (
        <>
          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="card"><div className="card-kicker">Total estimasi THR</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumThr)}</div></div>
            <div className="card"><div className="card-kicker">Sudah dibayar</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumThrDibayar)}</div></div>
            <div className="card"><div className="card-kicker">Belum dibayar</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumThr - sumThrDibayar)}</div></div>
          </div>
          <div className="card">
            {thrRows.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p> : (
              <>
              <table className="table">
                <thead><tr><SortableTh label="Nama" sortKey="name" activeKey={thrSortKey} dir={thrSortDir} onSort={toggleThrSort} /><th>Tempat kerja</th><th>Masa kerja</th><th>THR</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {pagedThr.map(({ e, t }) => (
                    <tr key={e.id}>
                      <td>{e.name}</td><td>{e.site.name}</td>
                      <td className="text-muted">{Math.floor(t.months / 12)} tahun {t.months % 12} bulan</td>
                      <td>{formatRp(t.thr)}</td>
                      <td><span className={e.thrPaid ? "tag tag-accent" : "tag tag-outline"}>{e.thrPaid ? "Sudah dibayar" : "Belum dibayar"}</span></td>
                      <td><ThrButton employeeId={e.id} disabled={e.thrPaid} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={pageThr} totalItems={totalThr} onChange={setPageThr} />
              </>
            )}
          </div>
          <p style={{ fontSize: 12, opacity: 0.55, marginTop: "var(--space-3)" }}>
            THR dihitung 1x gaji pokok untuk masa kerja ≥12 bulan, proporsional untuk yang kurang — sesuai PP 36/2021.
          </p>
        </>
      )}

      {tab === "insentif" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
              <div className="card-kicker">Total bonus/insentif dibayar</div>
              <div className="card-title" style={{ fontSize: 20 }}>{formatRp(sumAllowance)}</div>
            </div>
            <PayAllowanceDialog employees={employeeOptions} />
          </div>
          <p style={{ fontSize: 12, opacity: 0.55, marginTop: 0, marginBottom: "var(--space-3)" }}>
            Pembayaran di luar gaji tanggal 1 — dicatat sebagai transaksi kas tersendiri, tidak ikut masuk ke perhitungan Gaji Bulanan.
          </p>
          <div className="card">
            {allowanceRows.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada pembayaran bonus/insentif.</p> : (
              <>
              <table className="table">
                <thead><tr><SortableTh label="Tanggal" sortKey="date" activeKey={allowanceSortKey} dir={allowanceSortDir} onSort={toggleAllowanceSort} /><SortableTh label="Karyawan" sortKey="empName" activeKey={allowanceSortKey} dir={allowanceSortDir} onSort={toggleAllowanceSort} /><th>Jumlah</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {pagedAllowance.map((p) => (
                    <tr key={p.id}>
                      <td className="text-muted">{p.date.toLocaleDateString("id-ID")}</td>
                      <td>{p.empName}</td>
                      <td>{formatRp(p.amount)}</td>
                      <td className="text-muted">{p.desc ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={pageAllowance} totalItems={totalAllowance} onChange={setPageAllowance} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
