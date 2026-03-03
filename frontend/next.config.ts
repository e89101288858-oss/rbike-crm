import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/admin', destination: '/owner/settings', permanent: true },
      { source: '/dashboard-owner', destination: '/owner', permanent: true },
    ]
  },
};

export default nextConfig;
