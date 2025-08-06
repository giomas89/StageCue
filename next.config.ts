import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',  // Aggiunto per generare build statica
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true,  // Necessario per l'export statico
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'midi=*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
