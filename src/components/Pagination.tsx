"use client";

import { useState } from "react";

export const PAGE_SIZE = 20;

// Slices `rows` to the current page, clamping automatically if a filter
// shrinks the list out from under the current page number.
export function usePagedRows<T>(rows: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const clamped = clampPage(page, rows.length, pageSize);
  const paged = rows.slice((clamped - 1) * pageSize, clamped * pageSize);
  return { paged, page: clamped, setPage, totalItems: rows.length, pageSize };
}

export function Pagination({
  page,
  totalItems,
  pageSize = PAGE_SIZE,
  onChange,
}: {
  page: number;
  totalItems: number;
  pageSize?: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
      <span style={{ fontSize: 12, opacity: 0.6 }}>Menampilkan {start}–{end} dari {totalItems}</span>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Sebelumnya
        </button>
        <span style={{ fontSize: 13, opacity: 0.7 }}>Halaman {page} / {totalPages}</span>
        <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Berikutnya
        </button>
      </div>
    </div>
  );
}

// Clamp a page number that might now be out of range (e.g. after a filter
// shrinks the result set) — call this instead of using the raw state value.
export function clampPage(page: number, totalItems: number, pageSize = PAGE_SIZE): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}
