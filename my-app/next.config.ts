import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => process.env.NEXT_BUILD_ID ?? "development",
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
