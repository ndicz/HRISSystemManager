import type { LeaveRequest } from "@prisma/client";

export function countLeaveDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

// Matches the prototype's semantics: any approved leave request (regardless
// of type — Cuti Tahunan, Sakit, etc.) counts against the annual quota.
export function cutiTerpakai(requests: Pick<LeaveRequest, "status" | "startDate" | "endDate">[]): number {
  return requests
    .filter((r) => r.status === "disetujui")
    .reduce((sum, r) => sum + countLeaveDays(r.startDate, r.endDate), 0);
}
