// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    // Exclude the webpack build cache from Lambda bundles.
    // .next/cache/ is ~580 MB and not needed at runtime — it caused every
    // serverless function to exceed Vercel's 250 MB uncompressed limit.
    outputFileTracingExcludes: {
      "*": [".next/cache/**"],
    },
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

module.exports = nextConfig;
