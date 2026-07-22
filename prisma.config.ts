import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by the Prisma CLI only (migrate/generate/studio) — the running
    // app connects separately via its own pooled adapter in src/lib/db.ts.
    // Neon's pooled DATABASE_URL goes through PgBouncer, which doesn't
    // hold session-level advisory locks across statements, so
    // `migrate deploy` hangs and times out (P1002) if pointed at it.
    // DATABASE_URL_UNPOOLED is the direct connection Neon's Vercel
    // integration provisions alongside DATABASE_URL.
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
