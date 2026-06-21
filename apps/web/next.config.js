// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  async redirects() {
    return [
      // Canonical login/register shortcuts → actual auth pages.
      // Middleware redirects to /auth/login; these aliases make /login work too.
      { source: '/login', destination: '/auth/login', permanent: false },
      { source: '/register', destination: '/auth/register', permanent: false },
      { source: '/signin', destination: '/auth/login', permanent: false },
      { source: '/signup', destination: '/auth/register', permanent: false },
    ]
  },
  experimental: {
    // Exclude the webpack build cache from Lambda bundles.
    // .next/cache/ is ~580 MB and not needed at runtime — it caused every
    // serverless function to exceed Vercel's 250 MB uncompressed limit.
    outputFileTracingExcludes: {
      "*": [".next/cache/**"],
    },
    // Required for src/instrumentation.ts to run on server startup (Next.js 14).
    instrumentationHook: true,
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
  eslint: {
    // ESLint warnings in pre-existing components do not block production builds.
    // CI lint step (pnpm lint) still runs separately for enforcement.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
