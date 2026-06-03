/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow components to render properly during local dev
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
