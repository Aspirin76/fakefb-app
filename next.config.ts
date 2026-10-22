import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // OpenCode client 是在 Node 端跑的，不要被 bundler 打包
  serverExternalPackages: [
    "@opencode/client",
    "@opencode/schema",
    "@opencode/protocol",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
