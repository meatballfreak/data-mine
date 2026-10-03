import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to 1 MB which is below our 4 MB trainee file
    // upload cap. Raise to 4 MB; Vercel Hobby allows up to 4.5 MB per
    // request body, so this leaves a small margin for form overhead.
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
