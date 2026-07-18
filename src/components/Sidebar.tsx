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

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className={`nav-item${active ? " active" : ""}`}>
      {item.label}
    </Link>
  );
}

function NavGroupSection({ group, items, pathname }: { group: NavGroup; items: NavItem[]; pathname: string }) {
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
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const items = navForRole(userRole);
  const standalone = items.filter((i) => !i.group);
  const groups = NAV_GROUP_ORDER.map((g) => ({ group: g, items: items.filter((i) => i.group === g) })).filter((g) => g.items.length > 0);

  return (
    <div
      style={{
        width: 224,
        flexShrink: 0,
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-divider)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-6) var(--space-4)",
        gap: "var(--space-5)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 22, letterSpacing: "-0.01em" }}>
        Industri<span style={{ color: "var(--color-accent-700)" }}>.</span>HR
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {standalone.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {standalone.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </div>
        )}
        {groups.map(({ group, items: groupItems }) => (
          <NavGroupSection key={group} group={group} items={groupItems} pathname={pathname} />
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
  );
}
