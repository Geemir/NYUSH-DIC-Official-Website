import type { NextConfig } from "next";

/* Set by the deploy workflow from GitHub Pages' configuration, e.g.
   "/NYUSH-DIC-Official-Website". Empty for local dev and custom domains. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // Static export: deployable to GitHub Pages, Cloudflare Pages, Aliyun OSS,
  // any static host. No Node server, which keeps mainland-China hosting open.
  output: "export",

  basePath,

  // Emits /challenge/index.html instead of /challenge.html so plain static
  // hosts resolve directory URLs without extra config.
  trailingSlash: true,

  images: {
    // next/image's default loader needs a server; static export cannot use it.
    unoptimized: true,
  },
};

export default nextConfig;
