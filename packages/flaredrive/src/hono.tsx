import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc/server";
import type { Context } from "hono";
import type { ComponentType } from "react";
import { withRequest, type PageProps } from "./context.js";
import { LocationProvider } from "./location.js";
import { FLIGHT_TYPE, wantsFlight, type FlightPayload } from "./protocol.js";
import { exportContext } from "./ssg.js";

export type { PageProps } from "./context.js";

export interface PageOptions {
  /** HTTP status of the page. Fixed before streaming starts. Defaults to 200. */
  status?: number;
}

/** A Hono handler. It also satisfies `app.notFound()` and `app.onError()`-style signatures. */
export type PageHandler = (c: Context) => Promise<Response>;

/**
 * Adapts a page component to a Hono route. The same URL serves HTML to
 * browsers and a Flight stream to requests that accept `text/x-component`.
 * Only GET and HEAD are allowed: there is no action dispatch endpoint.
 */
export function page(
  Component: ComponentType<PageProps>,
  options: PageOptions = {},
): PageHandler {
  const status = options.status ?? 200;

  return async function handlePage(c) {
    const request = c.req.raw;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const flight = wantsFlight(request);

    // Keep headers set by upstream middleware, then add ours.
    const headers = new Headers(c.res.headers);
    const vary = headers.get("Vary");
    headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "private, no-store");
    }
    headers.set(
      "Content-Type",
      flight ? `${FLIGHT_TYPE}; charset=utf-8` : "text/html; charset=utf-8",
    );

    if (request.method === "HEAD") {
      return new Response(null, { status, headers });
    }

    const props: PageProps = {
      url: new URL(request.url),
      params: c.req.param(),
    };

    return withRequest(props, async () => {
      const exporting = exportContext.getStore();
      const payload: FlightPayload = {
        href: props.url.href,
        staticPaths: exporting?.paths,
        root: (
          <LocationProvider href={props.url.href}>
            <Component {...props} />
          </LocationProvider>
        ),
      };

      let stream = renderToReadableStream(payload, {
        onError(error: unknown) {
          console.error("[flaredrive] RSC render error", error);
          return "FLAREDRIVE_RSC_ERROR";
        },
      });

      if (exporting?.capture) {
        const [primary, copy] = stream.tee();
        stream = primary;
        exporting.capture(copy);
      }

      if (flight) {
        return new Response(stream, { status, headers });
      }

      const ssr = await import.meta.viteRsc.loadModule<
        typeof import("./entry.ssr.js")
      >("ssr", "index");
      const html = await ssr.renderHTML(stream);

      return new Response(html.stream, {
        status: html.status ?? status,
        headers,
      });
    });
  };
}
