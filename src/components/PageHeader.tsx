import type { ReactNode } from "react";

// Icon-badge + title/subtitle + actions — replaces the bare <h1>/<p> block
// every page used to hand-roll. Keeps the exact same .page-header-row >
// .page-header DOM shape those pages already had (including the
// accessibility-hide-on-mobile behavior for .page-header in globals.css),
// just enriches .page-header's contents with the icon + lays out actions
// as a sibling, same as before.
export function PageHeader({
  icon, title, subtitle, actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-3)" }}>
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div className="page-header-icon">{icon}</div>
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>{actions}</div>}
    </div>
  );
}
