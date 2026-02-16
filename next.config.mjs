/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Unblocks production builds even if ESLint has errors.
    // Keep running `pnpm lint` separately in your workflow.
    ignoreDuringBuilds: true,
  },

  images: {
    // If you use remote images (https://...), add your hosts here.
    // remotePatterns: [
    //   { protocol: "https", hostname: "cdn.yourdomain.com", pathname: "/**" },
    // ],
  },
};

export default nextConfig;
