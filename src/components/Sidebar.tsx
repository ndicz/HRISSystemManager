"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/(app)/actions";
import { navForRole, NAV_GROUP_ORDER, type NavGroup, type NavItem } from "@/lib/rbac";

const GROUP_LABEL: Record<NavGroup, string> = {
  SDM: "SDM",
  Keuangan: "Keuangan",
  Kepatuhan: "Kepatuhan",
  Sistem: "Sistem",
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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

// One small line-icon per destination, keyed by href, so the drawer reads
// at a glance instead of as a wall of text.
const NAV_ICONS: Record<string, React.ReactNode> = {
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

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  return (
    <Link href={item.href} className={`nav-item${active ? " active" : ""}`} onClick={onNavigate}>
      {NAV_ICONS[item.href]}
      {item.label}
    </Link>
  );
}

function NavGroupSection({ group, items, pathname, onNavigate }: { group: NavGroup; items: NavItem[]; pathname: string; onNavigate: () => void }) {
  const storageKey = "sidebar-group-" + group;
  const containsActive = items.some((i) => isActive(pathname, i.href));
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setExpanded(stored === "1");
    else if (containsActive) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (containsActive) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          opacity: 0.5,
        }}
      >
        {GROUP_LABEL[group]}
        <span style={{ fontSize: 10, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}>▶</span>
      </button>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userName, userRole, pageAccess }: { userName: string; userRole: string; pageAccess?: string[] }) {
  const pathname = usePathname();
  const items = navForRole(userRole, pageAccess);
  const standalone = items.filter((i) => !i.group);
  const groups = NAV_GROUP_ORDER.map((g) => ({ group: g, items: items.filter((i) => i.group === g) })).filter((g) => g.items.length > 0);
  const activeLabel = items.find((i) => isActive(pathname, i.href))?.label ?? "Industri.HR";

  const [open, setOpen] = useState(false);
  // Close the mobile drawer whenever the route changes, without a
  // set-state-in-effect (React's "adjusting state on prop change" pattern).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }
  const close = () => setOpen(false);

  // Lock background scroll while the drawer covers the screen, like a
  // native app sheet — this only touches the DOM (an external system), so
  // it belongs in an effect.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const brand = (
    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 22, letterSpacing: "-0.01em" }}>
      Industri<span style={{ color: "var(--color-accent-700)" }}>.</span>HR
    </div>
  );

  return (
    <>
      <div className="mobile-topbar">
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeLabel}
        </div>
        <button type="button" className="btn btn-icon btn-secondary" onClick={() => setOpen(true)} aria-label="Buka menu">
          <HamburgerIcon />
        </button>
      </div>

      <button type="button" className={`sidebar-backdrop${open ? " sidebar-open" : ""}`} onClick={close} aria-label="Tutup menu" tabIndex={open ? 0 : -1} />

      <div className={`sidebar${open ? " sidebar-open" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {brand}
          <button type="button" className="btn btn-icon btn-secondary sidebar-close-btn" onClick={close} aria-label="Tutup menu">
            <CloseIcon />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {standalone.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              {standalone.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={close} />
              ))}
            </div>
          )}
          {groups.map(({ group, items: groupItems }) => (
            <NavGroupSection key={group} group={group} items={groupItems} pathname={pathname} onNavigate={close} />
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {userName} <span className="text-muted">· {userRole}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="btn btn-secondary" style={{ width: "100%" }}>
              Keluar
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
