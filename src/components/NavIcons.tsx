// One small line-icon per route, keyed by href — used by both Sidebar
// (the nav drawer) and PageHeader (each page's own header badge), so a
// route shows the same icon in both places. Deliberately not a "use
// client" module (nothing here needs hooks/interactivity) so Server
// Component pages can import NAV_ICONS directly for PageHeader without
// pulling in Sidebar's client bundle.

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="nav-item-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const NAV_ICONS: Record<string, React.ReactNode> = {
  "/": (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  ),
  "/absensi": (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </Icon>
  ),
  "/laporan": (
    <Icon>
      <line x1="4" y1="21" x2="20" y2="21" />
      <rect x="6" y="13" width="3" height="8" />
      <rect x="11" y="9" width="3" height="12" />
      <rect x="16" y="5" width="3" height="16" />
    </Icon>
  ),
  "/karyawan": (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </Icon>
  ),
  "/cuti": (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Icon>
  ),
  "/rekrutmen": (
    <Icon>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </Icon>
  ),
  "/penggajian": (
    <Icon>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="9" x2="6.01" y2="9" />
      <line x1="18" y1="15" x2="18.01" y2="15" />
    </Icon>
  ),
  "/kas": (
    <Icon>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <line x1="16" y1="14" x2="16.01" y2="14" />
    </Icon>
  ),
  "/klien": (
    <Icon>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <rect x="8" y="7" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="7" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="8" y="12" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="12" width="2" height="2" fill="currentColor" stroke="none" />
      <path d="M9 21v-4h6v4" />
    </Icon>
  ),
  "/gudang": (
    <Icon>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <line x1="12" y1="13" x2="12" y2="22" />
    </Icon>
  ),
  "/mbp": (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 3v3h6V3" />
      <polyline points="8.5 13 10.5 15 15.5 10" />
    </Icon>
  ),
  "/crm": (
    <Icon>
      <path d="M3 4h18l-7 8v6l-4 2v-8z" />
    </Icon>
  ),
  "/pajak": (
    <Icon>
      <path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </Icon>
  ),
  "/kemenaker": (
    <Icon>
      <path d="M12 2l8 3.5v5.2c0 5.1-3.4 8.7-8 10.3-4.6-1.6-8-5.2-8-10.3V5.5L12 2z" />
      <polyline points="8.5 12 11 14.5 15.5 9.5" />
    </Icon>
  ),
  "/audit": (
    <Icon>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </Icon>
  ),
  "/pengguna": (
    <Icon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.6 2.5-6.2 5.5-6.2s5.5 2.6 5.5 6.2" />
      <circle cx="17.5" cy="8.5" r="2.4" />
      <path d="M15.5 13.6c2.3.2 4 2.4 4 6.4" />
    </Icon>
  ),
};
