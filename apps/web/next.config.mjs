import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    // Tell Next.js output file tracing to start from the monorepo root so that
    // pnpm symlinks into the workspace-level node_modules are followed correctly.
    // This is required for Vercel serverless functions to include
    // next/dist/compiled/next-server/server.runtime.prod.js in their bundle.
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

export default nextConfig;
