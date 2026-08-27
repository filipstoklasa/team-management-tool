import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * The job of this policy is egress control, not XSS hardening (§7, §9.1):
 * `connect-src 'self'` is what makes "no external network calls carrying app
 * data" something the browser enforces rather than something we promise.
 *
 * script/style are 'unsafe-inline' because Next.js inlines the RSC payload and
 * critical CSS without a nonce. Tightening those would need nonce middleware and
 * would not improve the guarantee that actually matters here.
 *
 * Dev is exempt: HMR needs 'unsafe-eval' and a websocket to the dev server.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Native module with a prebuilt .node binary — must never be bundled.
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    if (!isProd) return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
