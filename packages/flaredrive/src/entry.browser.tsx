import { createFromReadableStream } from "@vitejs/plugin-rsc/browser";
import {
  Component,
  startTransition,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { hydrateRoot } from "react-dom/client";
import { rscStream } from "rsc-html-stream/client";
import {
  FLIGHT_TYPE,
  shouldIntercept,
  staticFlightPath,
  type FlightPayload,
} from "./protocol.js";
import { installRefresh } from "./refresh.js";

interface Snapshot {
  payload: FlightPayload;
  revision: number;
}

/** Shown when a Flight fetch or the resulting render fails. The link forces a document load. */
function Failure() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Page unavailable</title>
      </head>
      <body>
        <h1>This page could not be displayed</h1>
        <p>Reload to try again.</p>
        <a href={window.location.href} data-native>
          Reload
        </a>
      </body>
    </html>
  );
}

class Boundary extends Component<
  { children: ReactNode; revision: number },
  { failed: boolean; revision: number }
> {
  override state = { failed: false, revision: 0 };

  static getDerivedStateFromProps(
    props: { revision: number },
    state: { revision: number },
  ) {
    return props.revision === state.revision
      ? null
      : { failed: false, revision: props.revision };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? <Failure /> : this.props.children;
  }
}

async function main() {
  // The Flight payload is embedded in the HTML, so hydration needs no extra GET.
  const initial = await createFromReadableStream<FlightPayload>(rscStream);
  const staticPaths = initial.staticPaths;

  let revision = 0;
  let inflight: AbortController | undefined;
  let leavingNatively = false;
  let commit: (snapshot: Snapshot) => void = () => {};
  const committed = new Map<number, () => void>();

  const { promise: hydrated, resolve: markHydrated } =
    Promise.withResolvers<void>();

  function Root() {
    const [snapshot, setSnapshot] = useState<Snapshot>({
      payload: initial,
      revision: 0,
    });
    commit = setSnapshot;

    useLayoutEffect(() => {
      markHydrated();
      committed.get(snapshot.revision)?.();
    }, [snapshot]);
    return (
      <Boundary revision={snapshot.revision}>{snapshot.payload.root}</Boundary>
    );
  }

  /** Falls back to a full document navigation. */
  function leave(url: string) {
    leavingNatively = true;
    window.location.assign(url);
  }

  /**
   * Fetches the Flight payload for `href` and commits it. Resolves once React
   * has committed the new tree (or the navigation was superseded).
   */
  async function load(href: string, external?: AbortSignal): Promise<void> {
    inflight?.abort();
    const controller = (inflight = new AbortController());
    const signal = external
      ? AbortSignal.any([controller.signal, external])
      : controller.signal;
    const current = ++revision;
    const superseded = () => signal.aborted || current !== revision;
    const url = new URL(href);

    try {
      if (staticPaths && (url.search || !staticPaths.includes(url.pathname))) {
        // Pure SSG: only prerendered pathnames have Flight files.
        leave(href);
        return;
      }

      const target = staticPaths
        ? new URL(staticFlightPath(url.pathname), url)
        : url;
      const response = await fetch(target, {
        headers: { Accept: FLIGHT_TYPE },
        signal,
      });
      if (superseded()) {
        return;
      }

      if (response.redirected) {
        leave(response.url);
        return;
      }

      if (!response.headers.get("content-type")?.startsWith(FLIGHT_TYPE)) {
        leave(href);
        return;
      }

      if (!response.body) {
        throw new Error("Empty Flight response");
      }

      const payload = await createFromReadableStream<FlightPayload>(
        response.body,
      );

      if (superseded()) {
        return;
      }

      // Use the browser URL, not the (possibly synthetic) server-side one.
      payload.href = href;

      await new Promise<void>((resolve) => {
        const finish = () => {
          committed.delete(current);
          signal.removeEventListener("abort", finish);
          resolve();
        };

        committed.set(current, finish);
        signal.addEventListener("abort", finish, { once: true });
        startTransition(() => commit({ payload, revision: current }));
      });
    } catch (error) {
      if (superseded()) {
        return;
      }

      console.error("[flaredrive] navigation failed", error);
      commit({ payload: { href, root: <Failure /> }, revision: current });
      if (!external) {
        throw error;
      }
    }
  }

  hydrateRoot(document, <Root />);
  await hydrated;

  installRefresh(() => load(window.location.href));

  window.navigation?.addEventListener("navigate", (event) => {
    if (leavingNatively) {
      leavingNatively = false;
      return;
    }

    if (!shouldIntercept(event, window.location.href)) {
      return;
    }

    event.intercept({
      handler: () => load(event.destination.url, event.signal),
    });
  });

  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", () => {
      load(window.location.href).catch(() => {});
    });
  }
}

void main();
