"use client";

import { useState } from "react";
import { fetchMbpRequests } from "@/app/(app)/mbp/actions";
import { MbpRequestForm } from "@/components/MbpRequestForm";
import { MbpRequestTable } from "@/components/MbpRequestTable";

type RequestRow = {
  id: string; itemName: string; unit: string; qty: number; cost: number;
  requesterName: string; siteName: string | null; note: string | null;
  status: string; decisionNote: string | null; mbpId: string | null; createdAt: Date;
};
type ItemOption = { id: string; name: string; unit: string; price: number };

// Restricted self-service view for a logged-in field employee (role
// EMPLOYEE): only their own request history, no ACC/Tolak (that's an office
// decision), no access to the MBP/Penawaran document tab at all.
export function MyMbpRequestsPanel({
  requests: initialRequests, items, siteNames, myName,
}: {
  requests: RequestRow[]; items: ItemOption[]; siteNames: string[]; myName: string;
}) {
  const [requests, setRequests] = useState(initialRequests);

  // fetchMbpRequests() is scoped to the caller's own requests server-side
  // for an EMPLOYEE session, so this refetch never leaks anyone else's data.
  async function refresh() {
    setRequests(await fetchMbpRequests());
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <div className="card-kicker">Permintaan Saya</div>
        <MbpRequestForm items={items} employees={[]} siteNames={siteNames} lockedRequesterName={myName} onSuccess={refresh} />
      </div>
      <MbpRequestTable requests={requests} showDecisions={false} />
    </div>
  );
}
