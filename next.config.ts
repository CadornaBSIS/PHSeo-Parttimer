import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdfkit", "fontkit"],
};

export default nextConfig;
