"use client";

import { useState } from "react";
import { formatRp } from "@/lib/payroll";
import { mbpTotal } from "@/lib/finance";
import { fetchMbpRequests, fetchMbps } from "@/app/(app)/mbp/actions";
import { MbpRequestForm } from "@/components/MbpRequestForm";
import { MbpRequestTable } from "@/components/MbpRequestTable";
import { CreateMbpDialog } from "@/components/CreateMbpDialog";
import { MbpTable } from "@/components/MbpTable";
import type { EmployeeOption } from "@/components/EmployeeCombobox";
import type { ClientOption } from "@/components/ClientCombobox";

type RequestRow = {
  id: string; itemName: string; unit: string; qty: number; cost: number;
  requesterName: string; siteName: string | null; note: string | null;
  status: string; decisionNote: string | null; mbpId: string | null; createdAt: Date;
};
type MbpRow = {
  id: string; mbpNo: string; clientId: string | null; clientNameManual: string | null; clientName: string;
  date: Date; jobTitle: string | null; signerName: string | null; withPpn: boolean; ppnPercent: number;
  status: string; invoiceBjId: string | null; items: { desc: string; qty: number; cost: number; price: number }[];
};
type ItemOption = { id: string; name: string; unit: string; price: number };

const TABS = ["permintaan", "mbp"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { permintaan: "Permintaan", mbp: "MBP / Penawaran" };

export function MbpPageTabs({
  requests: initialRequests, mbps: initialMbps, items, employees, siteNames, clients,
}: {
  requests: RequestRow[]; mbps: MbpRow[]; items: ItemOption[];
  employees: EmployeeOption[]; siteNames: string[]; clients: ClientOption[];
}) {
  const [tab, setTab] = useState<Tab>("permintaan");
  // Held in local state and refetched directly after each mutation — more
  // reliable than depending on the page-level refresh a Server Action
  // normally triggers, which doesn't reach this already-mounted tree (same
  // fetch-and-setState pattern as fetchSalaryComponents elsewhere in the app).
  const [requests, setRequests] = useState(initialRequests);
  const [mbps, setMbps] = useState(initialMbps);

  // Creating an Mbp can also consume approved MbpRequest rows (sets their
  // mbpId), so a change on either side refreshes both lists together —
  // simpler and always-correct versus tracking which mutation touched what.
  async function refreshAll() {
    const [freshRequests, freshMbps] = await Promise.all([fetchMbpRequests(), fetchMbps()]);
    setRequests(freshRequests);
    setMbps(freshMbps);
  }

  const pendingCount = requests.filter((r) => r.status === "menunggu").length;
  const approvedUnconsumed = requests.filter((r) => r.status === "disetujui" && !r.mbpId);
  const totalPenawaranAktif = mbps
    .filter((m) => m.status === "draft" || m.status === "terkirim" || m.status === "disetujui_klien")
    .reduce((s, m) => s + mbpTotal(m.items, m.withPpn, m.ppnPercent), 0);
  const totalDikonversi = mbps.filter((m) => m.invoiceBjId).length;

  return (
    <div>
      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="card"><div className="card-kicker">Permintaan menunggu ACC</div><div className="card-title" style={{ fontSize: 22 }}>{pendingCount}</div></div>
        <div className="card"><div className="card-kicker">Nilai jual MBP aktif</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(totalPenawaranAktif)}</div></div>
        <div className="card"><div className="card-kicker">Sudah jadi invoice</div><div className="card-title" style={{ fontSize: 22 }}>{totalDikonversi}</div></div>
      </div>

      <div className="seg" role="radiogroup" style={{ width: "fit-content", marginBottom: "var(--space-4)" }}>
        {TABS.map((t) => (
          <label key={t} className="seg-opt">
            <input type="radio" name="mbptab" checked={tab === t} onChange={() => setTab(t)} />
            {TAB_LABEL[t]}
          </label>
        ))}
      </div>

      {tab === "permintaan" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <div className="card-kicker">Permintaan Barang</div>
            <MbpRequestForm items={items} employees={employees} siteNames={siteNames} onSuccess={refreshAll} />
          </div>
          <MbpRequestTable requests={requests} onChanged={refreshAll} />
        </div>
      )}

      {tab === "mbp" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <div className="card-kicker">MBP / Penawaran</div>
            <CreateMbpDialog clients={clients} pendingRequests={approvedUnconsumed} onSuccess={refreshAll} />
          </div>
          <MbpTable mbps={mbps} clients={clients} onChanged={refreshAll} />
        </div>
      )}
    </div>
  );
}
