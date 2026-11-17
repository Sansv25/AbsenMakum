import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/ticketing/new',
        destination: '/ticketing?create=true',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
