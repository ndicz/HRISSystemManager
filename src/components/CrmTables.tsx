"use client";

import { useState } from "react";
import { formatRp } from "@/lib/payroll";
import { fetchLeads } from "@/app/(app)/crm/actions";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { LeadDetailDialog } from "@/components/LeadDetailDialog";
import { Avatar } from "@/components/Avatar";

export type LeadRow = {
  id: string;
  companyName: string;
  picName: string | null;
  picPhone: string | null;
  picEmail: string | null;
  address: string | null;
  estimatedValue: number;
  stage: string;
  lostReason: string | null;
  clientId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  activities: { id: string; note: string; createdAt: Date }[];
};

// Category-coded (which stage, not how urgent) — matches the pastel
// pipeline-stage tags in the Behance reference.
export const STAGE_TAG: Record<string, string> = {
  kontak_awal: "tag tag-blue",
  penawaran: "tag tag-teal",
  negosiasi: "tag tag-purple",
  deal: "tag tag-green",
  batal: "tag tag-danger",
};
export const STAGE_LABEL: Record<string, string> = {
  kontak_awal: "Kontak Awal",
  penawaran: "Penawaran",
  negosiasi: "Negosiasi",
  deal: "Deal",
  batal: "Batal",
};

const FILTERS = ["semua", "kontak_awal", "penawaran", "negosiasi", "deal", "batal"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  semua: "Semua",
  kontak_awal: "Kontak Awal",
  penawaran: "Penawaran",
  negosiasi: "Negosiasi",
  deal: "Deal",
  batal: "Batal",
};

export function CrmTables({ leads: initialLeads }: { leads: LeadRow[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<Filter>("semua");

  async function refresh() {
    setLeads(await fetchLeads());
  }

  const totalPipelineValue = leads
    .filter((l) => l.stage !== "batal" && !l.clientId)
    .reduce((s, l) => s + l.estimatedValue, 0);
  const dealsWon = leads.filter((l) => l.clientId).length;

  const filtered = filter === "semua" ? leads : leads.filter((l) => l.stage === filter);

  return (
    <div>
      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card"><div className="card-kicker">Total prospek</div><div className="card-title" style={{ fontSize: 22 }}>{leads.length}</div></div>
        <div className="card stat-gradient stat-gradient-a"><div className="card-kicker">Nilai pipeline aktif</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(totalPipelineValue)}</div></div>
        <div className="card"><div className="card-kicker">Deal menang</div><div className="card-title" style={{ fontSize: 22 }}>{dealsWon}</div></div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div className="seg" role="radiogroup" style={{ flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <label key={f} className="seg-opt">
                <input type="radio" name="crmfilter" checked={filter === f} onChange={() => setFilter(f)} />
                {FILTER_LABEL[f]}
              </label>
            ))}
          </div>
          <AddLeadDialog onSuccess={refresh} />
        </div>

        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{leads.length === 0 ? "Belum ada prospek." : "Tidak ada hasil untuk filter ini."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Perusahaan</th>
                  <th>PIC</th>
                  <th>Estimasi Nilai</th>
                  <th>Tahap</th>
                  <th>Follow-up</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td>{l.companyName}</td>
                    <td className="text-muted">{l.picName ? <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}><Avatar name={l.picName} size={24} />{l.picName}</span> : "-"}</td>
                    <td style={{ fontWeight: 600 }}>{formatRp(l.estimatedValue)}</td>
                    <td>
                      <span className={STAGE_TAG[l.stage]}>{STAGE_LABEL[l.stage]}</span>
                      {l.clientId && <span className="tag tag-accent" style={{ marginLeft: 6 }}>Sudah Klien</span>}
                    </td>
                    <td className="text-muted">{l.activities.length} catatan</td>
                    <td><LeadDetailDialog lead={l} onChanged={refresh} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
