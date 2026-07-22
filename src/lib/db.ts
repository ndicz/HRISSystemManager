import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 dropped the bundled Rust query engine — every provider needs an
// explicit driver adapter. This is the Postgres (Neon) adapter; the earlier
// SQLite dev setup used @prisma/adapter-better-sqlite3 here instead.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // node-postgres defaults to closing idle pool connections after just
  // 10s — far shorter than Neon's own compute suspend timeout (5min
  // default). That mismatch meant almost every gap between requests
  // (any normal pause between clicks/page loads) forced a brand new
  // TCP+TLS handshake to Neon, each one costing ~2-3s on its own —
  // measured directly: every relation query in a page's `include` was
  // paying this per-query since Prisma fires them concurrently, each
  // grabbing its own fresh connection from a cold pool. Keeping
  // connections alive well past normal request gaps (but still under
  // Neon's own suspend window) lets the pool actually stay warm.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 4 * 60 * 1000,
    keepAlive: true,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
