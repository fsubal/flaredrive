import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginOption } from "vite";
import { forbidServerFunctions } from "./guard.js";

export { assertNoServerFunctions, forbidServerFunctions } from "./guard.js";

export interface FlaredriveOptions {
  /**
   * Module that default-exports the app (a Hono instance or anything with
   * `fetch(request)`), relative to the Vite root. Default: src/server.tsx
   */
  app?: string;
}

const CANDIDATES = ["src/server.tsx", "src/server.ts", "src/server.jsx", "src/server.js"];

function resolveApp(root: string, app: string | undefined): string {
  if (app) {
    const file = path.resolve(root, app);
    if (!existsSync(file)) {
      throw new Error(`[flaredrive] App module not found: ${file}`);
    }
    return file;
  }
  for (const candidate of CANDIDATES) {
    const file = path.resolve(root, candidate);
    if (existsSync(file)) return file;
  }
  throw new Error(
    `[flaredrive] No app module found. Create src/server.tsx or pass { app } to flaredrive().`,
  );
}

const local = (file: string) => fileURLToPath(new URL(file, import.meta.url));

/**
 * The Vite plugin set: rejects Server Functions, wires the three RSC
 * environments to the framework's entries, and enables React Fast Refresh.
 */
export default function flaredrive(options: FlaredriveOptions = {}): PluginOption[] {
  return [
    forbidServerFunctions(),
    {
      name: "flaredrive:app",
      config(config) {
        const root = path.resolve(config.root ?? process.cwd());
        const app = resolveApp(root, options.app);
        return {
          resolve: {
            alias: [{ find: /^virtual:flaredrive\/app$/, replacement: app }],
          },
          environments: {
            rsc: { resolve: { noExternal: ["flaredrive"] } },
            ssr: { resolve: { noExternal: ["flaredrive"] } },
            client: { optimizeDeps: { exclude: ["flaredrive"] } },
          },
        };
      },
    },
    rsc({
      entries: {
        rsc: local("./entry.rsc.js"),
        ssr: local("./entry.ssr.js"),
        client: local("./entry.browser.js"),
      },
    }),
    react(),
  ];
}
