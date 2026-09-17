"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveLatenessBrackets, deleteLatenessBrackets } from "@/app/(app)/penggajian/actions";
import { formatRp, type LatenessBracketLike } from "@/lib/payroll";
import { formatActionError } from "@/lib/errors";

type Option = { id: string; name: string };
type Scope = "global" | "site" | "position" | "employee";

const SCOPE_LABEL: Record<Scope, string> = { global: "Default (semua karyawan)", site: "Tempat kerja tertentu", position: "Jabatan tertentu", employee: "Karyawan tertentu" };

type Row = { rowId: number; minMinutes: number; maxMinutes: number | null; amount: number };
let nextRowId = 1;

function emptyRow(): Row {
  return { rowId: nextRowId++, minMinutes: 0, maxMinutes: null, amount: 0 };
}

function rowsFromBrackets(brackets: LatenessBracketLike[]): Row[] {
  return brackets
    .slice()
    .sort((a, b) => a.minMinutes - b.minMinutes)
    .map((b) => ({ rowId: nextRowId++, minMinutes: b.minMinutes, maxMinutes: b.maxMinutes, amount: b.amount }));
}

export function LatenessBracketDialog({
  sites, positions, employees, brackets,
}: {
  sites: Option[]; positions: Option[]; employees: Option[]; brackets: LatenessBracketLike[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Distinct (scope, ref) groups that already have rows configured, so HR
  // can see and re-open an existing table instead of guessing what's set.
  const existingConfigs = useMemo(() => {
    const seen = new Map<string, { scope: Scope; refId: string | null; count: number }>();
    for (const b of brackets) {
      const refId = b.scope === "site" ? b.siteId : b.scope === "position" ? b.positionId : b.scope === "employee" ? b.employeeId : null;
      const key = b.scope + ":" + (refId ?? "");
      const existing = seen.get(key);
      if (existing) existing.count++;
      else seen.set(key, { scope: b.scope as Scope, refId, count: 1 });
    }
    return [...seen.values()];
  }, [brackets]);

  function labelFor(scope: Scope, refId: string | null): string {
    if (scope === "global") return "Default (semua karyawan)";
    const list = scope === "site" ? sites : scope === "position" ? positions : employees;
    return list.find((o) => o.id === refId)?.name ?? "(tidak dikenal)";
  }

  const [scope, setScope] = useState<Scope>("global");
  const [refId, setRefId] = useState("");
  const [rows, setRows] = useState<Row[]>(() => {
    const existing = rowsFromBrackets(brackets.filter((b) => b.scope === "global"));
    return existing.length > 0 ? existing : [emptyRow()];
  });

  function loadScope(nextScope: Scope, nextRefId: string) {
    setScope(nextScope);
    setRefId(nextRefId);
    setError("");
    const matching = brackets.filter((b) => {
      if (b.scope !== nextScope) return false;
      if (nextScope === "site") return b.siteId === nextRefId;
      if (nextScope === "position") return b.positionId === nextRefId;
      if (nextScope === "employee") return b.employeeId === nextRefId;
      return true;
    });
    setRows(matching.length > 0 ? rowsFromBrackets(matching) : [emptyRow()]);
  }

  function updateRow(rowId: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  async function handleSave() {
    setPending(true);
    setError("");
    try {
      const cleanRows = rows
        .filter((r) => r.amount > 0 || r.minMinutes > 0)
        .map((r) => ({ minMinutes: r.minMinutes, maxMinutes: r.maxMinutes, amount: r.amount }));
      await saveLatenessBrackets(scope, scope === "global" ? null : refId || null, cleanRows);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteScope() {
    if (!window.confirm(`Hapus semua aturan keterlambatan untuk "${labelFor(scope, scope === "global" ? null : refId)}"?`)) return;
    setPending(true);
    setError("");
    try {
      await deleteLatenessBrackets(scope, scope === "global" ? null : refId || null);
      setRows([emptyRow()]);
      router.refresh();
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setPending(false);
    }
  }

  const refOptions = scope === "site" ? sites : scope === "position" ? positions : scope === "employee" ? employees : [];

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Atur potongan keterlambatan</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Potongan keterlambatan</div>
            <p style={{ fontSize: 12.5, opacity: 0.65, marginTop: -4, marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
              Tabel menit telat &rarr; potongan Rp. Kalau tidak diisi apa pun di sini, sistem tetap pakai tarif flat per
              hari telat dari &ldquo;Atur tarif potongan &amp; lembur&rdquo; seperti biasa. Karyawan tertentu menang atas
              jabatannya, jabatan menang atas tempat kerjanya, tempat kerja menang atas default umum — cuma satu tabel
              yang dipakai per karyawan, tidak digabung.
            </p>

            {existingConfigs.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "var(--space-3)" }}>
                {existingConfigs.map((c) => (
                  <button
                    key={c.scope + ":" + c.refId}
                    type="button"
                    className={scope === c.scope && (c.scope === "global" || refId === c.refId) ? "tag tag-accent" : "tag tag-outline"}
                    style={{ cursor: "pointer", border: "none" }}
                    onClick={() => loadScope(c.scope, c.refId ?? "")}
                  >
                    {labelFor(c.scope, c.refId)} ({c.count})
                  </button>
                ))}
              </div>
            )}

            <div className="field">
              <label htmlFor="lb-scope">Berlaku untuk</label>
              <select
                className="input"
                id="lb-scope"
                value={scope}
                onChange={(e) => loadScope(e.target.value as Scope, "")}
              >
                {(Object.entries(SCOPE_LABEL) as [Scope, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {scope !== "global" && (
              <div className="field">
                <label htmlFor="lb-ref">{scope === "site" ? "Tempat kerja" : scope === "position" ? "Jabatan" : "Karyawan"}</label>
                <select className="input" id="lb-ref" value={refId} onChange={(e) => loadScope(scope, e.target.value)}>
                  <option value="">Pilih…</option>
                  {refOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Rentang menit telat &rarr; potongan</label>
              <div style={{ display: "grid", gap: 6 }}>
                {rows.map((row) => (
                  <div key={row.rowId} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1.4fr auto", gap: 6, alignItems: "center" }}>
                    <input
                      className="input" type="number" min={0} value={row.minMinutes}
                      onChange={(e) => updateRow(row.rowId, { minMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      placeholder="dari (menit)"
                    />
                    <span style={{ fontSize: 12, opacity: 0.6 }}>&ndash;</span>
                    <input
                      className="input" type="number" min={0} value={row.maxMinutes ?? ""}
                      onChange={(e) => updateRow(row.rowId, { maxMinutes: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      placeholder="sampai (kosong = tak terbatas)"
                    />
                    <input
                      className="input" type="number" min={0} value={row.amount}
                      onChange={(e) => updateRow(row.rowId, { amount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      placeholder="Potongan (Rp)"
                    />
                    <button type="button" className="btn btn-ghost" onClick={() => removeRow(row.rowId)} disabled={rows.length <= 1} title="Hapus baris">&times;</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary" onClick={addRow} style={{ width: "fit-content", marginTop: "var(--space-2)" }}>+ Tambah rentang</button>
            </div>

            {rows.some((r) => r.amount > 0) && (
              <p style={{ fontSize: 12, opacity: 0.55, margin: "var(--space-2) 0 0" }}>
                Contoh: telat 1&ndash;15 menit = {formatRp(rows[0]?.amount ?? 0)}.
              </p>
            )}

            {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: "var(--space-2) 0 0" }}>{error}</p>}
            <div className="dialog-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={handleDeleteScope} disabled={pending} style={{ marginRight: "auto" }}>
                Hapus aturan ini
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Tutup</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={pending || (scope !== "global" && !refId)}>
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
