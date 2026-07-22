import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Neon's pooled (PgBouncer) endpoint hostname always has a "-pooler" suffix;
// the direct endpoint is the exact same host without it. Deriving the direct
// URL this way — instead of depending on a second env var whose exact name
// varies by how Neon was provisioned — only ever needs DATABASE_URL to
// exist. No-ops for non-Neon hosts (e.g. local Postgres in dev), since
// there's no "-pooler" suffix to strip.
function directDatabaseUrl(pooledUrl: string): string {
  const url = new URL(pooledUrl);
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  return url.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by the Prisma CLI only (migrate/generate/studio) — the running
    // app connects separately via its own pooled adapter in src/lib/db.ts.
    // Neon's pooled connection goes through PgBouncer, which doesn't hold
    // session-level advisory locks across statements, so `migrate deploy`
    // hangs and times out (P1002) if pointed at it — the CLI needs the
    // direct connection instead.
    url: directDatabaseUrl(env("DATABASE_URL")),
  },
});
