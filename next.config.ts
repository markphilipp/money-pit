import type { NextConfig } from 'next';

/**
 * "No network calls" is the app's central privacy constraint, so state it as a policy the browser
 * enforces rather than one code review has to catch. `connect-src 'self'` is as tight as this can
 * go: App Router client navigations fetch RSC payloads from this origin.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // The settings screens used to be top-level routes; keep bookmarks and old links working.
  async redirects() {
    return [
      { source: '/datasets', destination: '/settings/datasets', permanent: false },
      { source: '/categories', destination: '/settings/categories', permanent: false },
      { source: '/rules/:path*', destination: '/settings/rules/:path*', permanent: false },
    ];
  },
  async headers() {
    // dev needs the HMR websocket and eval'd sourcemaps, both of which this CSP forbids
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
