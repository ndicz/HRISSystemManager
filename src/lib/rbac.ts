export type Role = "ADMIN" | "HR" | "FINANCE" | "SUPERVISOR" | "EMPLOYEE";

export type NavGroup = "SDM" | "Keuangan" | "Kepatuhan" | "Sistem";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  group?: NavGroup; // omitted for standalone top-level items (e.g. Dashboard)
};

export const NAV_GROUP_ORDER: NavGroup[] = ["SDM", "Keuangan", "Kepatuhan", "Sistem"];

// Access map — adjust per role as the organization's actual structure requires.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["ADMIN", "HR", "FINANCE", "SUPERVISOR", "EMPLOYEE"] },
  { href: "/absensi", label: "Absensi", roles: ["ADMIN", "HR", "SUPERVISOR"], group: "SDM" },
  { href: "/karyawan", label: "Karyawan & Lokasi", roles: ["ADMIN", "HR"], group: "SDM" },
  { href: "/cuti", label: "Cuti", roles: ["ADMIN", "HR", "SUPERVISOR"], group: "SDM" },
  { href: "/rekrutmen", label: "Rekrutmen", roles: ["ADMIN", "HR"], group: "SDM" },
  { href: "/penggajian", label: "Penggajian", roles: ["ADMIN", "HR", "FINANCE"], group: "Keuangan" },
  { href: "/kas", label: "Pengeluaran & Kas", roles: ["ADMIN", "FINANCE"], group: "Keuangan" },
  { href: "/klien", label: "Klien & Tagihan", roles: ["ADMIN", "FINANCE"], group: "Keuangan" },
  { href: "/pajak", label: "Laporan Pajak", roles: ["ADMIN", "HR", "FINANCE"], group: "Kepatuhan" },
  { href: "/kemenaker", label: "Laporan Kemenaker", roles: ["ADMIN", "HR"], group: "Kepatuhan" },
  { href: "/audit", label: "Audit Log", roles: ["ADMIN"], group: "Sistem" },
];

// Routes that don't map to a single nav item but should still be reachable
// by anyone who can already see the page that links to them.
const OPEN_AUTHENTICATED_PREFIXES = ["/print/", "/akses-ditolak"];

export function canAccess(role: string, pathname: string): boolean {
  if (role === "ADMIN") return true;
  if (OPEN_AUTHENTICATED_PREFIXES.some((p) => pathname.startsWith(p))) return true;

  const item = NAV_ITEMS
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!item) return true; // no explicit rule — don't lock out unmapped routes
  return item.roles.includes(role as Role);
}

export function navForRole(role: string): NavItem[] {
  if (role === "ADMIN") return NAV_ITEMS;
  return NAV_ITEMS.filter((i) => i.roles.includes(role as Role));
}
