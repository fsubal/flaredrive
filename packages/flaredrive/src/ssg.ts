import { AsyncLocalStorage } from "node:async_hooks";

interface ExportStore {
  /** Every pathname that will exist as static HTML + Flight. */
  paths: string[];
  /** Receives a branch of the Flight stream while the HTML is rendered. */
  capture?: (stream: ReadableStream<Uint8Array>) => void;
}

/** Render-local storage used while exporting a page to static files. */
export const exportContext = new AsyncLocalStorage<ExportStore>();

export interface StaticRenderOptions {
  /** All pathnames being exported; embedded so the browser knows what is static. */
  paths: string[];
  /** Origin used for the synthetic request. Defaults to http://localhost. */
  origin?: string;
}

export interface StaticRenderResult {
  html: string;
  flight: Uint8Array;
}

/**
 * Performs one request through the app and returns the HTML and the Flight
 * payload produced by that single render.
 */
export async function renderStatic(
  app: { fetch(request: Request): Response | Promise<Response> },
  path: string,
  options: StaticRenderOptions,
): Promise<StaticRenderResult> {
  let flight: Promise<ArrayBuffer> | undefined;

  return exportContext.run(
    {
      paths: options.paths,
      capture(stream) {
        flight = new Response(stream).arrayBuffer();
      },
    },
    async () => {
      const url = new URL(path, options.origin ?? "http://localhost");
      const response = await app.fetch(new Request(url));
      const html = await response.text();

      if (response.status !== 200 || !flight) {
        throw new Error(
          `[flaredrive] Cannot export ${path}: the page responded with ${response.status}.`,
        );
      }

      return { html, flight: new Uint8Array(await flight) };
    },
  );
}
