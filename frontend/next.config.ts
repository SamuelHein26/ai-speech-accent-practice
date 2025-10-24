import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Basic configuration
  reactStrictMode: true,
  
  // Ensure proper path resolution
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;