import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config, { dev }) {
    if (dev && config.cache && typeof config.cache === "object" && config.cache.type === "filesystem") {
      // pnpm patches keep the package version; invalidate cached resolutions
      // when the lockfile (including patch hashes) changes, following the new symlink.
      const dependencyRevision = createHash("sha256")
        .update(readFileSync(path.join(workspaceRoot, "pnpm-lock.yaml")))
        .digest("hex");
      config.cache.version = `${config.cache.version ?? ""}|${dependencyRevision}`;
    }
    return config;
  },
  async headers() {
    return [{source:"/icons/lucide-static.6d04cab6d375.svg",headers:[
      {key:"Cache-Control",value:"public, max-age=31536000, immutable"},
    ]},{source:"/icons/lucide-static.e0e81a216d41.svg",headers:[
      {key:"Cache-Control",value:"public, max-age=31536000, immutable"},
    ]},{source:"/manifest.webmanifest",headers:[
      {key:"X-Robots-Tag",value:"noindex"},
      {key:"Cache-Control",value:"no-store"},
      {key:"X-Content-Type-Options",value:"nosniff"},
    ]}];
  },
  transpilePackages: [
    "@sohoin/core", "@sohoin/ui", "@sohoin/admin-ui", "@sohoin/extension-api",
    "@sohoin/database", "@sohoin/custom",
  ],
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
