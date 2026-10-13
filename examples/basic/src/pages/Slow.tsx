import { Suspense } from "react";
import { getRequestURL } from "flaredrive/server";
import { DeepContext } from "./Note.tsx";
import { Shell } from "./Shell.tsx";

async function Delayed() {
  const ms = Math.min(Number(getRequestURL().searchParams.get("ms")) || 100, 2000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <DeepContext />;
}

export function Slow() {
  return (
    <Shell title="Streaming">
      <h1>Streaming</h1>
      <Suspense fallback={<p>読み込み中…</p>}>
        <Delayed />
      </Suspense>
    </Shell>
  );
}
