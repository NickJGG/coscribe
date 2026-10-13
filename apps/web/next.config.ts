import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coscribe/editor"],
  // Import uploads a file of up to 2 MB, plus the form's other fields.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
