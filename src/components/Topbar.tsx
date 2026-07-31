// Persistent desktop topbar (search + notification chrome) — sits above
// .app-content, sibling to Sidebar's own mobile-only topbar. Not a client
// component: nothing here needs hooks/interactivity, the search input and
// bell are visual chrome only (see the .desktop-topbar CSS comment).

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function Topbar() {
  return (
    <div className="desktop-topbar">
      <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.45, pointerEvents: "none" }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          className="input input-search"
          placeholder="Cari sesuatu…"
          disabled
          style={{ paddingLeft: 38, paddingRight: 56, cursor: "default", opacity: 0.75 }}
        />
        <span className="desktop-topbar-kbd" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
          Ctrl K
        </span>
      </div>

      <button type="button" className="btn btn-icon btn-secondary" aria-label="Notifikasi" disabled style={{ opacity: 0.75, cursor: "default" }}>
        <BellIcon />
      </button>
    </div>
  );
}
