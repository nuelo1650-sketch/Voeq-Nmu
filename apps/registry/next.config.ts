import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma and pg-boss must stay outside the bundler (native engine binaries).
  serverExternalPackages: ["@prisma/client", "pg-boss"],
  // Build must not require provider credentials or a live DB — routes that
  // need them are dynamic (`force-dynamic`).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
