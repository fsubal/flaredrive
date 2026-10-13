import type { ReactNode } from "react";

/** Media type used to request and deliver the RSC (Flight) payload. */
export const FLIGHT_TYPE = "text/x-component";

/** The value exchanged as a Flight stream between server and browser. */
export interface FlightPayload {
  /** The page tree rendered by the Server Components. */
  root: ReactNode;
  /** Absolute URL the server rendered this payload for. */
  href: string;
  /** Present only in static exports: every pathname that has prerendered files. */
  staticPaths?: string[];
}

/**
 * Content negotiation for page routes. Flight is returned only when the
 * Accept header explicitly lists the Flight media type with a non-zero q.
 */
export function wantsFlight(request: Request): boolean {
  const accept = request.headers.get("accept");
  if (!accept) return false;

  return accept.split(",").some((entry) => {
    const [type, ...params] = entry.trim().split(";");
    if (type?.trim().toLowerCase() !== FLIGHT_TYPE) return false;
    return !params.some((param) => /^\s*q\s*=\s*0(?:\.0+)?\s*$/.test(param));
  });
}

/** Location of the prerendered Flight file for a static page. */
export function staticFlightPath(pathname: string): string {
  return `${pathname.replace(/\/+$/, "")}/index.rsc`;
}

/** Directory (relative to the export root) that holds a static page. */
export function staticPageDir(pathname: string): string {
  return pathname.replace(/\/+$/, "");
}

/** The subset of `NavigateEvent` that decides whether we intercept. */
export interface NavigateEventLike {
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: FormData | null;
  destination: { url: string };
  sourceElement?: Element | null;
}

/**
 * Only same-origin document navigations that are not form submissions,
 * downloads, hash changes, API or asset URLs, or explicitly native links
 * (`data-native`) are handled as Flight fetches.
 */
export function shouldIntercept(
  event: NavigateEventLike,
  currentHref: string,
): boolean {
  if (!event.canIntercept || event.hashChange) return false;
  if (event.downloadRequest != null || event.formData) return false;

  const url = new URL(event.destination.url);
  if (url.origin !== new URL(currentHref).origin) return false;
  if (/^\/(api|assets)(\/|$)/.test(url.pathname)) return false;
  if (event.sourceElement?.closest("[data-native]")) return false;

  return true;
}
