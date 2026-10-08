export type Role = "ADMIN" | "HR" | "FINANCE" | "SUPERVISOR" | "EMPLOYEE" | "MARKETING";

export type NavGroup = "SDM" | "Keuangan" | "Marketing" | "Kepatuhan" | "Sistem";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  group?: NavGroup; // omitted for standalone top-level items (e.g. Dashboard)
};

export const NAV_GROUP_ORDER: NavGroup[] = ["SDM", "Keuangan", "Marketing", "Kepatuhan", "Sistem"];

// Access map — adjust per role as the organization's actual structure requires.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["ADMIN", "HR", "FINANCE", "SUPERVISOR", "EMPLOYEE"] },
  { href: "/absensi", label: "Absensi", roles: ["ADMIN", "HR", "SUPERVISOR"], group: "SDM" },
  { href: "/laporan", label: "Laporan Kehadiran", roles: ["ADMIN", "HR", "SUPERVISOR"], group: "SDM" },
  { href: "/karyawan", label: "Karyawan & Lokasi", roles: ["ADMIN", "HR"], group: "SDM" },
  { href: "/cuti", label: "Cuti", roles: ["ADMIN", "HR", "SUPERVISOR"], group: "SDM" },
  { href: "/rekrutmen", label: "Rekrutmen", roles: ["ADMIN", "HR"], group: "SDM" },
  { href: "/penggajian", label: "Penggajian", roles: ["ADMIN", "HR", "FINANCE"], group: "Keuangan" },
  { href: "/kas", label: "Pengeluaran & Kas", roles: ["ADMIN", "FINANCE"], group: "Keuangan" },
  { href: "/gudang", label: "Gudang", roles: ["ADMIN", "HR", "FINANCE"], group: "Keuangan" },
  { href: "/mbp", label: "MBP", roles: ["ADMIN", "FINANCE", "EMPLOYEE"], group: "Keuangan" },
  { href: "/klien", label: "Klien & Tagihan", roles: ["ADMIN", "FINANCE"], group: "Keuangan" },
  { href: "/crm", label: "CRM", roles: ["ADMIN", "MARKETING"], group: "Marketing" },
  { href: "/pajak", label: "Laporan Pajak", roles: ["ADMIN", "HR", "FINANCE"], group: "Kepatuhan" },
  { href: "/kemenaker", label: "Laporan Kemenaker", roles: ["ADMIN", "HR"], group: "Kepatuhan" },
  { href: "/audit", label: "Audit Log", roles: ["ADMIN"], group: "Sistem" },
  { href: "/pengguna", label: "Pengguna", roles: ["ADMIN"], group: "Sistem" },
];

// Nav items an admin can hand-pick as a custom per-user allowlist. Dashboard
// is always reachable once logged in (except EMPLOYEE — see below), and user
// management stays admin-only no matter what — neither belongs in the picklist.
export const ASSIGNABLE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.href !== "/" && i.href !== "/pengguna");

// Routes that don't map to a nav item and are fine for any logged-in user.
const OPEN_AUTHENTICATED_PREFIXES = ["/akses-ditolak"];

// Print pages carry the same data as the page that links to them (a slip
// is someone's gaji, an invoice is client billing), so each is reachable
// exactly by whoever can open one of those pages — never "any logged-in
// user", which let a field EMPLOYEE read every slip gaji by editing the ID
// in the URL.
const PRINT_SOURCES: { prefix: string; pages: string[]; denyRoles?: Role[] }[] = [
  { prefix: "/print/slip-batch", pages: ["/penggajian"] },
  { prefix: "/print/slip/", pages: ["/penggajian"] },
  { prefix: "/print/final-settlement/", pages: ["/penggajian", "/karyawan"] },
  { prefix: "/print/invoice-outsourcing/", pages: ["/klien"] },
  { prefix: "/print/invoice-bj/", pages: ["/klien"] },
  // EMPLOYEE gets /mbp only for their own permintaan barang, never the
  // MBP/penawaran documents themselves.
  { prefix: "/print/mbp/", pages: ["/mbp"], denyRoles: ["EMPLOYEE"] },
  { prefix: "/print/inventory-request/", pages: ["/gudang"] },
];

// The office side of /mbp (MBP/penawaran, approving requests) — EMPLOYEE
// logins share the route but only for submitting their own requests.
export const MBP_OFFICE_DENY: Role[] = ["EMPLOYEE"];

// EMPLOYEE (field-request-only, see /mbp's restricted view) and MARKETING
// (CRM-only) are single-module logins — they deliberately don't get the
// company-wide Dashboard (headcount, cash position, etc.), unlike every
// other role.
function dashboardAllowed(role: string): boolean {
  return role !== "EMPLOYEE" && role !== "MARKETING";
}

export function canAccess(role: string, pathname: string, pageAccess?: string[]): boolean {
  if (role === "ADMIN") return true;
  // User management is sensitive enough to stay admin-only regardless of
  // any per-user override.
  if (pathname.startsWith("/pengguna")) return false;
  if (OPEN_AUTHENTICATED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith("/print/")) {
    const rule = PRINT_SOURCES.find((r) => pathname.startsWith(r.prefix));
    if (!rule || rule.denyRoles?.includes(role as Role)) return false;
    return rule.pages.some((page) => canAccess(role, page, pageAccess));
  }
  if (pathname === "/") return dashboardAllowed(role);

  const item = NAV_ITEMS
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!item) return true; // no explicit rule — don't lock out unmapped routes
  if (pageAccess && pageAccess.length > 0) return pageAccess.includes(item.href);
  return item.roles.includes(role as Role);
}

export function navForRole(role: string, pageAccess?: string[]): NavItem[] {
  if (role === "ADMIN") return NAV_ITEMS;
  const base = NAV_ITEMS.filter((i) => i.href !== "/pengguna" && (i.href !== "/" || dashboardAllowed(role)));
  if (pageAccess && pageAccess.length > 0) {
    return base.filter((i) => (i.href === "/" && dashboardAllowed(role)) || pageAccess.includes(i.href));
  }
  return base.filter((i) => i.roles.includes(role as Role));
}
