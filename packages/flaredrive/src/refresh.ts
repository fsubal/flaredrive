type RefreshHandler = () => Promise<void>;

let handler: RefreshHandler | undefined;

/** Internal: the browser runtime registers how to re-fetch the current page. */
export function installRefresh(next: RefreshHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = undefined;
  };
}

/**
 * Re-fetches the Flight payload for the current URL and commits it, keeping
 * Client Component state where React can reconcile it. Call it after a
 * mutation request succeeded.
 */
export async function refresh(): Promise<void> {
  if (!handler) {
    throw new Error(
      "[flaredrive] refresh() is only available in the browser after hydration.",
    );
  }
  await handler();
}
