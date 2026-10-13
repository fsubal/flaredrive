"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// The server-rendered URL. It seeds the SSR snapshot of useLocation().
const LocationContext = createContext("http://localhost/");

/** Internal: wraps every page so Client Components know the request URL during SSR. */
export function LocationProvider({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return <LocationContext value={href}>{children}</LocationContext>;
}

function subscribe(callback: () => void) {
  window.navigation?.addEventListener("currententrychange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  return () => {
    window.navigation?.removeEventListener("currententrychange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
  };
}

/**
 * The current browser URL as a reactive value. During SSR it reflects the
 * request URL; after hydration it follows the address bar.
 */
export function useLocation(): URL {
  const serverHref = useContext(LocationContext);
  const href = useSyncExternalStore(
    subscribe,
    () => window.location.href,
    () => serverHref,
  );
  return new URL(href);
}
