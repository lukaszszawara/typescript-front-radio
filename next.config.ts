import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Required by the task: single self-contained server bundle executed via `node server.js`.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn6.polskieradio.pl' },
    ],
  },
};

export default nextConfig;
