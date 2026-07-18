"use client";

import { useEffect } from "react";

export function AutoPrint({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [title]);

  return (
    <div className="no-print" style={{ display: "flex", gap: 8, fontFamily: "system-ui, sans-serif" }}>
      <button type="button" onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1d1f20", background: "#1d1f20", color: "#fff", cursor: "pointer", fontSize: 13 }}>
        Cetak dokumen
      </button>
      <button type="button" onClick={() => window.close()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 13 }}>
        Tutup
      </button>
    </div>
  );
}
