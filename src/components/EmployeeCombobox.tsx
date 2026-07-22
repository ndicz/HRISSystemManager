"use client";

import { useEffect, useRef, useState } from "react";

export type EmployeeOption = { id: string; name: string; empCode: string };

// Searchable employee picker — filters by name or empCode (e.g. "EMP-0004")
// as you type, instead of scrolling a plain <select> through the whole
// company roster. Submits via a hidden <input>, so it drops into any
// existing <form action={...}> the same way a <select name="employeeId">
// did.
export function EmployeeCombobox({
  employees,
  name,
  id,
  value,
  onChange,
  placeholder = "Cari nama atau ID karyawan...",
}: {
  employees: EmployeeOption[];
  name: string;
  id?: string;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = employees.find((e) => e.id === value) ?? null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? employees.filter((e) => (e.name + " " + e.empCode).toLowerCase().includes(needle))
    : employees;

  function selectEmployee(e: EmployeeOption) {
    onChange(e.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        className="input"
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={open ? query : selected ? `${selected.name} (${selected.empCode})` : ""}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onClick={() => setOpen(true)}
      />
      <input type="hidden" name={name} value={value} />
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
            maxHeight: 220, overflowY: "auto", background: "var(--color-surface)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 4,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "var(--space-2) var(--space-3)", fontSize: 13, opacity: 0.6 }}>Tidak ditemukan.</div>
          ) : (
            filtered.map((e) => (
              <button
                type="button"
                key={e.id}
                onClick={() => selectEmployee(e)}
                style={{
                  display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                  fontSize: 14, padding: "var(--space-2) var(--space-3)", borderRadius: "calc(var(--radius-md) * 0.6)",
                  background: e.id === value ? "var(--color-accent-100)" : "transparent",
                  color: "var(--color-text)", fontFamily: "var(--font-body)",
                }}
              >
                {e.name} <span style={{ opacity: 0.55, fontSize: 12 }}>&middot; {e.empCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
