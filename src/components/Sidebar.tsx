"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/(app)/actions";
import { navForRole, NAV_GROUP_ORDER, type NavGroup, type NavItem } from "@/lib/rbac";
import { NAV_ICONS } from "@/components/NavIcons";
import { Avatar } from "@/components/Avatar";

const GROUP_LABEL: Record<NavGroup, string> = {
  SDM: "SDM",
  Keuangan: "Keuangan",
  Marketing: "Marketing",
  Kepatuhan: "Kepatuhan",
  Sistem: "Sistem",
};

// Small colored bullet per nav group — same hues as the .tag-blue/green/
// purple/pink/teal category tags used elsewhere, so "which section" reads
// at a glance the same way it does in tables.
const GROUP_DOT_COLOR: Record<NavGroup, string> = {
  SDM: "oklch(58% 0.13 255)",
  Keuangan: "oklch(58% 0.13 150)",
  Marketing: "oklch(58% 0.14 300)",
  Kepatuhan: "oklch(58% 0.16 340)",
  Sistem: "oklch(58% 0.09 195)",
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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

function NavLink({ item, active, badge, onNavigate }: { item: NavItem; active: boolean; badge?: number; onNavigate: () => void }) {
  return (
    <Link href={item.href} className={`nav-item${active ? " active" : ""}`} onClick={onNavigate}>
      {active ? <span className="nav-item-icon-badge">{NAV_ICONS[item.href]}</span> : NAV_ICONS[item.href]}
      {item.label}
      {!!badge && <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>}
    </Link>
  );
}

function NavGroupSection({ group, items, pathname, badgeCounts, onNavigate }: { group: NavGroup; items: NavItem[]; pathname: string; badgeCounts?: Record<string, number>; onNavigate: () => void }) {
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
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GROUP_DOT_COLOR[group], flexShrink: 0 }} />
          {GROUP_LABEL[group]}
        </span>
        <span style={{ fontSize: 10, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}>▶</span>
      </button>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} badge={badgeCounts?.[item.href]} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  userName, userRole, pageAccess, badgeCounts,
}: {
  userName: string; userRole: string; pageAccess?: string[]; badgeCounts?: Record<string, number>;
}) {
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
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        className="flex items-center justify-center rounded-lg text-white"
        style={{ width: 32, height: 32, flexShrink: 0, background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-800))" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: "-0.01em" }}>
        Industri.HR
      </div>
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
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} badge={badgeCounts?.[item.href]} onNavigate={close} />
              ))}
            </div>
          )}
          {groups.map(({ group, items: groupItems }) => (
            <NavGroupSection key={group} group={group} items={groupItems} pathname={pathname} badgeCounts={badgeCounts} onNavigate={close} />
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Avatar name={userName} size={28} />
            <div style={{ fontSize: 12, opacity: 0.7, overflow: "hidden" }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
              <div className="text-muted">{userRole}</div>
            </div>
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
