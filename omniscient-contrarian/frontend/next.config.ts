import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this frontend folder. The parent project has its own
  // package-lock.json which otherwise makes Turbopack infer the wrong root and fail.
  turbopack: {
    root: "C:/Users/Faazy/Documents/Omniscient/omniscient-contrarian/frontend",
  },
};

export default nextConfig;
