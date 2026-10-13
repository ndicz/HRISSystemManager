"use client";

import { useState, useSyncExternalStore } from "react";

// A quiet explanatory note. With `dismissKey`, the person can close it and
// it stays closed in this browser (localStorage; falls back to "shown" when
// storage is unavailable).
function readDismissed(key: string): boolean {
  try { return localStorage.getItem("info-note:" + key) === "1"; } catch { return false; }
}
const noop = () => () => {};

export function InfoNote({ children, dismissKey }: { children: React.ReactNode; dismissKey?: string }) {
  const stored = useSyncExternalStore(noop, () => (dismissKey ? readDismissed(dismissKey) : false), () => false);
  const [closed, setClosed] = useState(false);
  if (stored || closed) return null;
  return (
    <div className="info-note" role="note">
      <span className="info-note-icon" aria-hidden>i</span>
      <div>{children}</div>
      {dismissKey && (
        <button
          type="button"
          className="info-note-close"
          aria-label="Tutup catatan"
          onClick={() => {
            try { localStorage.setItem("info-note:" + dismissKey, "1"); } catch { /* not persisted */ }
            setClosed(true);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
