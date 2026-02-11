import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: __dirname,
  turbopack: {},
  eslint: {
    // Désactiver ESLint pendant le build pour accélérer
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Désactiver la vérification TypeScript pendant le build
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
