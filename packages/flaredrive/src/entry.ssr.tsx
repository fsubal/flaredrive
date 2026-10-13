import {
  createFromReadableStream,
  getClientEntryUrl,
} from "@vitejs/plugin-rsc/ssr";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { FlightPayload } from "./protocol.js";

export interface HTMLResult {
  stream: ReadableStream<Uint8Array>;
  /** Set only when the shell failed to render and a fallback document is returned. */
  status?: number;
}

/**
 * Turns a Flight stream into streaming HTML. The same Flight bytes are
 * embedded in the document so the browser hydrates without a second GET.
 */
export async function renderHTML(
  flight: ReadableStream<Uint8Array>,
): Promise<HTMLResult> {
  const [forRender, forHydration] = flight.tee();

  let payload: Promise<FlightPayload> | undefined;
  function Root() {
    payload ??= createFromReadableStream<FlightPayload>(forRender);
    return use(payload).root;
  }

  try {
    const html = await renderToReadableStream(<Root />, {
      bootstrapModules: [getClientEntryUrl()],
    });
    return { stream: html.pipeThrough(injectRSCPayload(forHydration)) };
  } catch (error) {
    console.error("[flaredrive] SSR render error", error);
    void forHydration.cancel();
    return {
      status: 500,
      stream: new Response(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>Error</title></head><body><h1>Rendering failed</h1></body></html>",
      ).body!,
    };
  }
}
