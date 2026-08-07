import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rhdxfpkrxeuymihhkyxo.supabase.co",
        pathname: "/storage/v1/object/public/repuestos/**",
      },
    ],
  },
};

export default nextConfig;
