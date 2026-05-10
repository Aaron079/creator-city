import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    // pnpm monorepo: node_modules/.pnpm/ is at the workspace root, which is two
    // levels above apps/web/. Without this, Next.js output file tracing uses
    // apps/web/ as root and cannot follow pnpm symlinks outside it, causing
    // next/dist/compiled/next-server/server.runtime.prod.js to be missing from
    // Vercel Lambda bundles → all Node.js serverless functions crash (500).
    outputFileTracingRoot: path.resolve('../../'),
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

export default nextConfig;
