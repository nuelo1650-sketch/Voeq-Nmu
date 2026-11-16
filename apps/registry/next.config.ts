import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Security headers (Phase 5.3). CSP notes, stated plainly:
//   - script-src keeps 'unsafe-inline' because Next.js hydration injects
//     inline bootstrap scripts; removing it means nonce round-tripping
//     through middleware. The inline surface is framework-generated, not
//     user input — revisit with a nonce when there is a reason to.
//   - img-src allows res.cloudinary.com: stage-8 promoted photos are served
//     from the public voeq/ Cloudinary account. data: covers compressed
//     preview placeholders.
//   - frame-ancestors 'none': the register is never framed — badge truth
//     flows through /api/public/verify, not through embedding pages.
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://res.cloudinary.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Prisma and pg-boss must stay outside the bundler (native engine binaries).
  serverExternalPackages: ["@prisma/client", "pg-boss"],
  // Build must not require provider credentials or a live DB — routes that
  // need them are dynamic (`force-dynamic`).
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS only in prod — localhost has no TLS and a cached HSTS pin
          // on a dev host is a footgun.
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
