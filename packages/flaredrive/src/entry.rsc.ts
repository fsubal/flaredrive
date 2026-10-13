import * as application from "virtual:flaredrive/app";
import { renderStatic, type StaticRenderOptions } from "./ssg.js";

const app = application.default;

/** Request handler consumed by the Vite RSC plugin and by `flaredrive serve`. */
export default {
  fetch(request: Request): Response | Promise<Response> {
    return app.fetch(request);
  },
};

/** Renders one static page. Used by `flaredrive generate`. */
export function prerender(path: string, options: StaticRenderOptions) {
  return renderStatic(app, path, options);
}

/** Resolves the app's optional `staticPaths` export. */
export async function resolveStaticPaths(): Promise<string[]> {
  const value = application.staticPaths;
  if (typeof value === "function") return value();
  return value ?? [];
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
