/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "./.next/**/*",
        ".next/**/*",
      ],
    },
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

export default nextConfig;
