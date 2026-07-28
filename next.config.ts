import type { NextConfig } from "next";

// Must match src/lib/basePath.ts's BASE_PATH exactly — the app is only
// reachable under this path prefix; the bare domain root 404s, on purpose.
const nextConfig: NextConfig = {
  basePath: "/HRIS_APPS",
};

export default nextConfig;
