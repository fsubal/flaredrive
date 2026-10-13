import { AsyncLocalStorage } from "node:async_hooks";

/** Props injected into every page component registered with `page()`. */
export interface PageProps {
  /** The request URL. Mutating it does not affect the request context. */
  url: URL;
  /** Route params resolved by the HTTP router (for example Hono's `:id`). */
  params: Readonly<Record<string, string>>;
}

interface RequestStore {
  href: string;
  params: Readonly<Record<string, string>>;
}

const storage = new AsyncLocalStorage<RequestStore>();

/**
 * Runs `callback` with a request-local context so that deep Server
 * Components can read `getRequestURL()` and `getRouteParams()`.
 * Used by the Hono adapter; also handy for unit tests of Server Components.
 */
export function withRequest<T>(props: PageProps, callback: () => T): T {
  return storage.run(
    { href: props.url.href, params: Object.freeze({ ...props.params }) },
    callback,
  );
}

function current(): RequestStore {
  const store = storage.getStore();
  if (!store) {
    throw new Error(
      "[flaredrive] Request context is only available while rendering a page on the server.",
    );
  }
  return store;
}

/** The URL of the request being rendered. Returns a fresh copy each call. */
export function getRequestURL(): URL {
  return new URL(current().href);
}

/** Route params of the request being rendered. The object is frozen. */
export function getRouteParams(): Readonly<Record<string, string>> {
  return current().params;
}
