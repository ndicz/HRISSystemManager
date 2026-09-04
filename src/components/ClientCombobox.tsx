"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { findOrCreateClientByName } from "@/app/(app)/klien/actions";

export type ClientOption = { id: string; name: string };

function comboItemStyle(active: boolean): React.CSSProperties {
  return {
    display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
    fontSize: 14, padding: "var(--space-2) var(--space-3)", borderRadius: "calc(var(--radius-md) * 0.6)",
    background: active ? "var(--color-accent-100)" : "transparent",
    color: "var(--color-text)", fontFamily: "var(--font-body)",
  };
}

// Client picker for invoice dialogs — searches existing Client rows AND
// Site names (tempat kerja already tracked in Penggajian), since in
// practice both lists name the same hospitals but only Client rows can be
// billed. Picking a site-only match, or typing a name that matches
// neither, creates a new Client row on the spot via findOrCreateClientByName
// so invoicing never blocks on having added it from the Klien page first.
export function ClientCombobox({
  clients,
  siteNames = [],
  name,
  id,
  value,
  onChange,
  placeholder = "Cari atau ketik nama klien baru...",
}: {
  clients: ClientOption[];
  siteNames?: string[];
  name: string;
  id?: string;
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [resolving, startTransition] = useTransition();
  const [selectedName, setSelectedName] = useState(() => clients.find((c) => c.id === value)?.name ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const needle = query.trim().toLowerCase();
  const filteredClients = needle ? clients.filter((c) => c.name.toLowerCase().includes(needle)) : clients;
  const clientNamesLower = new Set(clients.map((c) => c.name.toLowerCase()));
  const filteredSites = siteNames
    .filter((s) => !clientNamesLower.has(s.toLowerCase()))
    .filter((s) => !needle || s.toLowerCase().includes(needle));
  const exactMatch = clients.some((c) => c.name.toLowerCase() === needle) || filteredSites.some((s) => s.toLowerCase() === needle);

  function selectClient(c: ClientOption) {
    onChange(c.id, c.name);
    setSelectedName(c.name);
    setQuery("");
    setOpen(false);
  }

  function selectByName(n: string) {
    startTransition(async () => {
      const res = await findOrCreateClientByName(n);
      onChange(res.id, res.name);
      setSelectedName(res.name);
      setQuery("");
      setOpen(false);
    });
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        className="input"
        id={id}
        type="text"
        autoComplete="off"
        placeholder={resolving ? "Menyimpan…" : placeholder}
        disabled={resolving}
        value={open ? query : selectedName}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onClick={() => setOpen(true)}
      />
      <input type="hidden" name={name} value={value} required />
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
            maxHeight: 240, overflowY: "auto", background: "var(--color-surface)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 4,
          }}
        >
          {filteredClients.map((c) => (
            <button type="button" key={c.id} onClick={() => selectClient(c)} style={comboItemStyle(c.id === value)}>
              {c.name}
            </button>
          ))}
          {filteredSites.length > 0 && (
            <>
              {filteredClients.length > 0 && <div style={{ borderTop: "1px solid var(--color-divider)", margin: "4px 0" }} />}
              <div style={{ fontSize: 11, opacity: 0.55, padding: "2px 10px" }}>Tempat kerja (belum jadi klien)</div>
              {filteredSites.map((s) => (
                <button type="button" key={s} onClick={() => selectByName(s)} style={comboItemStyle(false)}>
                  {s}
                </button>
              ))}
            </>
          )}
          {needle && !exactMatch && (
            <button type="button" onClick={() => selectByName(query.trim())} style={{ ...comboItemStyle(false), color: "var(--color-accent)" }}>
              + Tambah klien baru: &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {filteredClients.length === 0 && filteredSites.length === 0 && !needle && (
            <div style={{ padding: "var(--space-2) var(--space-3)", fontSize: 13, opacity: 0.6 }}>Ketik untuk mencari atau menambah klien baru.</div>
          )}
        </div>
      )}
    </div>
  );
}
