import { serve as listen, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FLIGHT_TYPE, staticPageDir } from "./protocol.js";
import type { StaticRenderOptions, StaticRenderResult } from "./ssg.js";

/** Shape of the built RSC entry (`dist/rsc/index.js`). */
interface BuiltEntry {
  default: { fetch(request: Request): Response | Promise<Response> };
  prerender(path: string, options: StaticRenderOptions): Promise<StaticRenderResult>;
  resolveStaticPaths(): Promise<string[]>;
}

async function loadEntry(entry: string): Promise<BuiltEntry> {
  // React picks its production build at import time.
  process.env.NODE_ENV ??= "production";
  return (await import(pathToFileURL(path.resolve(entry)).href)) as BuiltEntry;
}

export interface ServeOptions {
  /** Built RSC entry. Default: dist/rsc/index.js */
  entry?: string;
  /** Built client assets. Default: dist/client */
  clientDir?: string;
  hostname?: string;
  port?: number;
}

/** Starts a production Node.js server: static assets first, then the app. */
export async function serve(options: ServeOptions = {}): Promise<ServerType> {
  const app = await loadEntry(options.entry ?? "dist/rsc/index.js");
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 4173;

  const server = new Hono();
  server.use(
    "*",
    serveStatic({
      root: options.clientDir ?? "dist/client",
      onFound(filePath, c) {
        if (filePath.includes("/assets/")) {
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  server.all("*", (c) => app.default.fetch(c.req.raw));

  return new Promise((resolve) => {
    const instance = listen({ fetch: server.fetch, hostname, port }, (info) => {
      console.log(`[flaredrive] serving http://${hostname}:${info.port}`);
      resolve(instance);
    });
  });
}

export interface GenerateOptions {
  entry?: string;
  clientDir?: string;
  /** Output directory. Default: static */
  outDir?: string;
  /** Pathnames to export. Defaults to the app's `staticPaths` export. */
  paths?: string[];
  /** Origin for the synthetic requests. Default: http://localhost */
  origin?: string;
}

/**
 * Exports HTML and Flight files for each path. Both come from a single render
 * so they can never disagree. The result needs no RSC server at runtime.
 */
export async function generate(options: GenerateOptions = {}): Promise<string[]> {
  const app = await loadEntry(options.entry ?? "dist/rsc/index.js");
  const outDir = path.resolve(options.outDir ?? "static");
  const paths = options.paths?.length
    ? options.paths
    : await app.resolveStaticPaths();

  if (paths.length === 0) {
    throw new Error(
      "[flaredrive] Nothing to generate. Pass paths or export `staticPaths` from the app module.",
    );
  }
  for (const pathname of paths) {
    if (!pathname.startsWith("/") || /[?#]/.test(pathname)) {
      throw new Error(
        `[flaredrive] Static paths must be absolute pathnames without query or hash: ${pathname}`,
      );
    }
  }

  await mkdir(outDir, { recursive: true });
  await cp(path.resolve(options.clientDir ?? "dist/client"), outDir, {
    recursive: true,
  });

  for (const pathname of paths) {
    const dir = path.join(outDir, staticPageDir(pathname));
    await mkdir(dir, { recursive: true });
    const { html, flight } = await app.prerender(pathname, {
      paths,
      origin: options.origin,
    });
    await writeFile(path.join(dir, "index.html"), html);
    await writeFile(path.join(dir, "index.rsc"), flight);
    console.log(`[flaredrive] generated ${pathname}`);
  }

  return paths;
}

export interface PreviewOptions {
  /** Directory produced by `generate`. Default: static */
  dir?: string;
  hostname?: string;
  port?: number;
}

/** Serves a static export, with the Flight media type for `.rsc` files. */
export async function preview(options: PreviewOptions = {}): Promise<ServerType> {
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 4174;

  const server = new Hono();
  server.use(
    "*",
    serveStatic({
      root: options.dir ?? "static",
      onFound(filePath, c) {
        if (filePath.endsWith(".rsc")) {
          c.header("Content-Type", `${FLIGHT_TYPE}; charset=utf-8`);
        }
      },
    }),
  );

  return new Promise((resolve) => {
    const instance = listen({ fetch: server.fetch, hostname, port }, (info) => {
      console.log(`[flaredrive] previewing http://${hostname}:${info.port}`);
      resolve(instance);
    });
  });
}
