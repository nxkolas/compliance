import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => process.env.NEXT_BUILD_ID ?? "development",
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse"],
};

export default nextConfig;
