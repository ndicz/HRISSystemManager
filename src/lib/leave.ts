import type { LeaveRequest } from "@prisma/client";

const DAY_MS = 86400000;

export function countLeaveDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

// Matches the prototype's semantics: any approved leave request (regardless
// of type — Cuti Tahunan, Sakit, etc.) counts against the annual quota.
// The quota is per calendar year, so only the days that fall inside `year`
// count — a request spanning New Year is split between the two years, and
// last year's leave no longer eats into this year's quota.
export function cutiTerpakai(requests: Pick<LeaveRequest, "status" | "startDate" | "endDate">[], year: number = new Date().getFullYear()): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  return requests
    .filter((r) => r.status === "disetujui")
    .reduce((sum, r) => {
      const start = r.startDate > yearStart ? r.startDate : yearStart;
      const end = r.endDate < yearEnd ? r.endDate : yearEnd;
      return end < start ? sum : sum + countLeaveDays(start, end);
    }, 0);
}
