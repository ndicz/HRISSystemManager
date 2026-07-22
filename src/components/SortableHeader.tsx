"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";
type SortValue = string | number | Date | null | undefined;

// Generic click-to-sort table header: click toggles asc/desc on that column,
// clicking a different column switches to it (starting asc). `getValue`
// resolves a row to the comparable value for a given column key — numbers
// and Dates compare numerically, everything else falls back to a locale
// string compare (numeric-aware, so "WSP 2" sorts before "WSP 10").
export function useSortableRows<T>(
  rows: T[],
  getValue: (row: T, key: string) => SortValue,
  initial?: { key: string; dir?: SortDir },
) {
  const [sortKey, setSortKey] = useState<string | undefined>(initial?.key);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? "asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const withValue = rows.map((row) => ({ row, value: getValue(row, sortKey) }));
    withValue.sort((a, b) => {
      const va = a.value;
      const vb = b.value;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (va instanceof Date && vb instanceof Date) cmp = va.getTime() - vb.getTime();
      else if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "id", { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withValue.map((w) => w.row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sorted, sortKey, sortDir, toggleSort };
}

export function SortableTh({
  label,
  sortKey: key,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: string;
  activeKey?: string;
  dir: SortDir;
  onSort: (key: string) => void;
}) {
  const active = activeKey === key;
  return (
    <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} style={{ whiteSpace: "nowrap" }}>
      <button
        type="button"
        onClick={() => onSort(key)}
        style={{ all: "unset", cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {label}
        <span style={{ fontSize: 10, opacity: active ? 0.9 : 0.3 }}>
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}
