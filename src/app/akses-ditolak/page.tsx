import Link from "next/link";
import { auth } from "@/auth";
import { navForRole } from "@/lib/rbac";

export default async function AksesDitolakPage() {
  const session = await auth();
  const role = session?.user?.role ?? "EMPLOYEE";
  const firstAllowed = navForRole(role, session?.user?.pageAccess)[0]?.href ?? "/";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 22 }}>
        Industri<span style={{ color: "var(--color-accent-700)" }}>.</span>HR
      </div>
      <h1 style={{ margin: 0, fontSize: 20 }}>Akses ditolak</h1>
      <p style={{ maxWidth: "40ch", opacity: 0.7, margin: 0 }}>
        Peran akun Anda ({role}) tidak memiliki izin untuk membuka halaman ini. Hubungi admin jika Anda merasa ini keliru.
      </p>
      <Link href={firstAllowed} className="btn btn-primary">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
