import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index-static.html' },
        { source: '/pricing', destination: '/pricing.html' },
        { source: '/faq', destination: '/faq.html' },
        { source: '/contact', destination: '/contact.html' },
        { source: '/dashboard', destination: '/dashboard.html' },
      ],
    };
  },
};

export default nextConfig;
