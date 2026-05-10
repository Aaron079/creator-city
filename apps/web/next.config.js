// @ts-check
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    // pnpm monorepo: node_modules/.pnpm/ resolves 3 levels above apps/web/.
    // Without this, Next.js output file tracing (default root = apps/web/) cannot
    // follow pnpm symlinks that point outside apps/web/, so
    // next/dist/compiled/next-server/server.runtime.prod.js is missing from
    // Vercel Lambda bundles → all Node.js serverless functions crash (500).
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

module.exports = nextConfig;
