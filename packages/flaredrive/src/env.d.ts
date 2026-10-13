/// <reference types="vite/client" />
/// <reference types="@vitejs/plugin-rsc/types" />

// The application module. The Vite plugin aliases this specifier to the
// user's server entry (default: ./src/server.tsx), which must default-export
// an object with a Web-standard `fetch(request)` method, such as a Hono app.
declare module "virtual:flaredrive/app" {
  const app: { fetch(request: Request): Response | Promise<Response> };
  export default app;
  /** Optional list (or producer) of pathnames to prerender with `flaredrive generate`. */
  export const staticPaths:
    | string[]
    | (() => string[] | Promise<string[]>)
    | undefined;
}
