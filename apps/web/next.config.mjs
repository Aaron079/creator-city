/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

export default nextConfig;
