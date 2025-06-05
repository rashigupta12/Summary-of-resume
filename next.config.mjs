/** @type {import('next').NextConfig} */
const nextConfig = {
   experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
  },
    images: {
    domains: ['gojf7j54p4.ufs.sh'],
  },
};

export default nextConfig;
