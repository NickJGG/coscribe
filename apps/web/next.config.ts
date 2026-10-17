import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coscribe/editor"],
  // Import uploads a file of up to 2 MB, plus the form's other fields.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  outputFileTracingIncludes: {
    "/*": ["src/content/changelog/**/*.md"],
    // public/ isn't in server bundles, and the changelog checks which images have a dark variant.
    "/changelog": ["public/changelog/**/*.dark.*"],
    "/**/opengraph-image*": ["src/lib/og/fonts/*.ttf"],
  },
};

export default nextConfig;
