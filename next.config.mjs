/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow larger request bodies for project uploads (handled per-route).
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
