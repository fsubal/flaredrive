"use client";
import { useState } from "react";
import { useHydrated } from "./useHydrated.ts";

// Client state survives SPA navigation because the Shell keeps the same tree shape.
export function Counter() {
  const hydrated = useHydrated();
  const [count, setCount] = useState(0);
  return (
    <button disabled={!hydrated} onClick={() => setCount(count + 1)}>
      Client count: {count}
    </button>
  );
}
